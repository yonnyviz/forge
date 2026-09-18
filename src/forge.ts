import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ForgeFooterComponent } from "./forge-footer-component.js";
const initiativeStore = require("./initiative-store.js");

const {
  INITIATIVES_DIR,
  applyLegacyMigration,
  createWorkSession,
  createWorkflowRecord,
  deleteInitiative,
  ensureInitiativesDir,
  getRecentSessions,
  formatInitiativeLabel,
  formatInitiativeSummary,
  formatMigrationPlan,
  isWorkflowInitiative,
  listInitiatives,
  suggestInitiativeName,
  toKebabCase,
  planLegacyMigration,
  readJSON,
  generateCompletionFile,
} = initiativeStore;

interface InitiativeMetadata {
  name: string;
  displayName: string;
  description: string;
  goal: string;
  status: "active" | "paused" | "blocked" | "completed";
  phase: "planning" | "execution" | "review" | "complete";
  created: string;
  lastSession: string | null;
  lastUpdated: string;
  owner: string;
  tags: string[];
  sessionCount: number;
  relatedInitiatives: string[];
  schemaVersion?: number;
  documents?: { brief: string; memory: string; outputs: string };
  agent?: { readOrder: string[]; nextAction: string; affectedPaths: string[] };
}

interface ForgeState {
  activeInitiative: string | null;
  lastUpdated: string;
}

export default function (pi: ExtensionAPI) {
  let forgeState: ForgeState = {
    activeInitiative: null,
    lastUpdated: new Date().toISOString(),
  };

  // Restore state on session start
  pi.on("session_start", async (event, ctx) => {
    const entries = ctx.sessionManager.getEntries();
    for (const entry of entries) {
      if (entry.type === "custom" && entry.customType === "forge-state") {
        forgeState = entry.data as ForgeState;
        break;
      }
    }

    // A restored selection is not valid if this Pi process is rooted
    // elsewhere. The working directory is the source of truth.
    const currentInitiative = getCurrentInitiative(ctx.cwd);
    forgeState.activeInitiative = currentInitiative?.metadata.name || null;
    forgeState.lastUpdated = new Date().toISOString();

    // Register custom minimal footer for TUI mode
    if (ctx.mode === "tui") {
      ctx.ui.setFooter((tui, theme, footerData) => {
        return new ForgeFooterComponent(ctx, footerData, theme);
      });
    }

    // Fallback status for non-TUI modes (RPC, print)
    if (currentInitiative) {
      ctx.ui.setStatus("forge", `🔨 ${currentInitiative.metadata.name}`);
    } else {
      ctx.ui.setStatus("forge", "");
    }
  });

  // Single command: /forge
  pi.registerCommand("forge", {
    description: "Manage initiatives and work sessions",
    handler: async (args, ctx) => {
      try {
        ensureInitiativesDir();

        // Ignore any subcommand args - always run the smart workflow
        await mainWorkflow(ctx, pi, forgeState);
      } catch (error) {
        ctx.ui.notify(
          `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          "error"
        );
      }
    },
  });
}

function isValidKebabCase(name: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name);
}

function getCurrentInitiative(cwd: string): { path: string; metadata: InitiativeMetadata } | null {
  const path = resolve(cwd);
  const metadataPath = join(path, ".forge", "metadata.json");
  if (!existsSync(metadataPath)) return null;

  try {
    return { path, metadata: readJSON(metadataPath) as InitiativeMetadata };
  } catch {
    return null;
  }
}

/**
 * Switch the Pi session to an initiative directory (fresh session, no history).
 * Pi never calls process.chdir; the session header `cwd` is the working directory.
 */
async function switchToInitiative(
  ctx: ExtensionCommandContext,
  initPath: string,
  initiativeName: string
): Promise<boolean> {
  const target = resolve(initPath);

  if (!existsSync(join(target, ".forge", "metadata.json"))) {
    ctx.ui.notify(`Not a Forge initiative: ${target}`, "error");
    return false;
  }
  if (resolve(ctx.cwd) === target) {
    ctx.ui.notify(`Already in ${initiativeName}`, "info");
    return false;
  }

  try {
    await ctx.waitForIdle();

    // Creates an in-memory session whose header cwd = target, and whose file path
    // resolves to the default ~/.pi/agent/sessions/--<slug>--/ directory.
    const sm = SessionManager.create(target);
    const file = sm.getSessionFile();
    const header = sm.getHeader();
    if (!file || !header) {
      ctx.ui.notify("Could not allocate a session file", "error");
      return false;
    }

    // Pi does not flush the header until an assistant message exists, but
    // switchSession() -> SessionManager.open() falls back to process.cwd() when
    // the file is missing. Materialize the header so the cwd is authoritative.
    if (!existsSync(file)) {
      writeFileSync(file, `${JSON.stringify(header)}\n`, { flag: "wx" });
    }

    const { cancelled } = await ctx.switchSession(file, {
      withSession: async (next) => {
        next.ui.setStatus("forge", `🔨 ${initiativeName}`);
        next.ui.notify(`🔨 Switched to ${initiativeName}\n${target}`, "success");
      },
    });

    if (cancelled) {
      ctx.ui.notify("Switch cancelled by another extension", "info");
      return false;
    }
    return true;
  } catch (error) {
    ctx.ui.notify(
      `Switch failed: ${error instanceof Error ? error.message : String(error)}`,
      "error"
    );
    return false;
  }
}

async function deleteInitiativeFlow(
  ctx: ExtensionCommandContext,
  initiatives: InitiativeMetadata[],
  forgeState: ForgeState,
  pi: ExtensionAPI
) {
  if (initiatives.length === 0) {
    ctx.ui.notify("There are no initiatives to delete", "info");
    return;
  }

  const options = initiatives.map((init) => formatInitiativeLabel(init, forgeState.activeInitiative));
  const choice = await ctx.ui.select("🗑️ Select an initiative to delete:", options);
  if (!choice) return;

  const selectedIndex = options.indexOf(choice);
  const initiative = initiatives[selectedIndex];
  if (!initiative) return;

  const initPath = join(INITIATIVES_DIR, initiative.name);
  const sessions = getRecentSessions(initPath);

  const confirmed = await ctx.ui.confirm(
    `Delete '${initiative.name}'?`,
    `Path: ${initPath}\nSessions: ${sessions.length}\n\nThis cannot be undone.`
  );

  if (!confirmed) {
    ctx.ui.notify("Deletion cancelled", "info");
    return;
  }

  try {
    const result = deleteInitiative(initiative.name);
    
    // Clear state if deleting active initiative
    if (forgeState.activeInitiative === initiative.name) {
      forgeState.activeInitiative = null;
      forgeState.lastUpdated = new Date().toISOString();
      pi.appendEntry("forge-state", forgeState);
      ctx.ui.setStatus("forge", "");
    }
    
    ctx.ui.notify(
      `✓ Deleted '${result.name}' (${result.deletedSessions} session(s))`,
      "success"
    );
  } catch (error) {
    ctx.ui.notify(
      `Failed to delete: ${error instanceof Error ? error.message : String(error)}`,
      "error"
    );
  }
}

async function mainWorkflow(
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI,
  forgeState: ForgeState
) {
  const currentInitiative = getCurrentInitiative(ctx.cwd);
  const initiatives = listInitiatives() as InitiativeMetadata[];
  // An initiative rooted outside INITIATIVES_DIR is not returned by
  // listInitiatives(); keep it selectable so it never disappears from the menu.
  if (
    currentInitiative &&
    !initiatives.some((init) => init.name === currentInitiative.metadata.name)
  ) {
    initiatives.push(currentInitiative.metadata);
  }
  if (!currentInitiative && forgeState.activeInitiative) {
    forgeState.activeInitiative = null;
    forgeState.lastUpdated = new Date().toISOString();
    pi.appendEntry("forge-state", forgeState);
    ctx.ui.setStatus("forge", "");
  }

  // Show every initiative; selecting one outside the current working directory
  // switches the session into it.
  const quickTaskOption = "⚡ Continue as a quick task (no Forge record)";
  const createNewOption = "➕ Create persistent initiative";
  const deleteOption = "🗑️ Delete an initiative";
  const sortedInitiatives = [...initiatives].sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  );
  const initiativeOptions = [
    quickTaskOption,
    createNewOption,
    deleteOption,
    ...sortedInitiatives.map((init) => formatInitiativeLabel(init, forgeState.activeInitiative)),
  ];

  // Step 1: Select initiative
  const choice = await ctx.ui.select("🔨 Forge · Choose an initiative", initiativeOptions);
  if (!choice) return;

  if (choice === quickTaskOption) {
    ctx.ui.notify("Continuing as a quick task. No Forge record will be created.", "info");
    return;
  }

  if (choice === createNewOption) {
    await createInitiativeFlow(ctx, pi, forgeState);
    return;
  }

  if (choice === deleteOption) {
    await deleteInitiativeFlow(ctx, sortedInitiatives, forgeState, pi);
    return;
  }

  // Find the selected initiative without relying on decorative menu rows.
  const selectedIndex = initiativeOptions.indexOf(choice) - 3;
  const selectedInitiative = sortedInitiatives[selectedIndex];

  if (!selectedInitiative) return;

  // Step 2: Show initiative summary
  const initPath = currentInitiative?.metadata.name === selectedInitiative.name
    ? currentInitiative.path
    : join(INITIATIVES_DIR, selectedInitiative.name);
  const metadata = readJSON(join(initPath, ".forge", "metadata.json")) as InitiativeMetadata;

  if (resolve(initPath) !== resolve(ctx.cwd)) {
    await switchToInitiative(ctx, initPath, selectedInitiative.name);
    return;
  }

  // Update active state only for the initiative rooted at this Pi process.
  forgeState.activeInitiative = selectedInitiative.name;
  forgeState.lastUpdated = new Date().toISOString();
  pi.appendEntry("forge-state", forgeState);
  ctx.ui.setStatus("forge", `🔨 ${selectedInitiative.name}`);

  const recentSessions = getRecentSessions(initPath);
  ctx.ui.notify(
    formatInitiativeSummary(metadata, recentSessions, forgeState.activeInitiative),
    "info"
  );

  const legacyInitiative = !isWorkflowInitiative(initPath);
  const actionOptions = [
    ...(legacyInitiative ? ["🔄 Preview workflow migration"] : []),
    "➕ Start a new session",
    ...(recentSessions.length > 0
      ? ["▶️ Resume a recent session", ...recentSessions.slice(0, 5).map((s) => `     ${s}`)]
      : []),
    "⚙️ Update initiative status",
    ...(currentInitiative ? ["← Close"] : ["← All initiatives"]),
  ];

  const action = await ctx.ui.select(`🔨 ${metadata.displayName} · What next?`, actionOptions);
  if (!action) return;

  if (action === "🔄 Preview workflow migration") {
    await migrateInitiativeFlow(initPath, ctx);
  } else if (action === "➕ Start a new session") {
    await createSessionFlow(initPath, metadata, ctx, pi);
  } else if (action === "▶️ Resume a recent session") {
    // Show selection of which session to resume
    const sessionChoice = await ctx.ui.select("Select session to resume:", recentSessions);
    if (sessionChoice) {
      await resumeSessionFlow(initPath, metadata, sessionChoice, ctx, pi);
    }
  } else if (action.includes("     ")) {
    // User selected a specific session from the recent list
    const sessionName = action.trim();
    await resumeSessionFlow(initPath, metadata, sessionName, ctx, pi);
  } else if (action === "⚙️ Update initiative status") {
    await updateStatusFlow(initPath, metadata, ctx, pi);
  } else if (action === "← All initiatives") {
    await mainWorkflow(ctx, pi, forgeState);
  }
}

async function migrateInitiativeFlow(
  initPath: string,
  ctx: ExtensionCommandContext
) {
  const plan = planLegacyMigration(initPath);
  ctx.ui.notify(formatMigrationPlan(plan), plan.canMigrate ? "info" : "error");
  if (plan.alreadyCurrent || !plan.canMigrate) return;

  const confirmed = await ctx.ui.confirm(
    "Migrate legacy initiative?",
    "This creates brief.md and memory.md, backs up metadata, and preserves all legacy files."
  );
  if (!confirmed) return;

  const result = applyLegacyMigration(initPath);
  ctx.ui.notify(`✓ Migration complete\nBackup: ${result.backupPath}`, "success");
}

async function createInitiativeFlow(
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI,
  forgeState: ForgeState
) {
  const about = await ctx.ui.input("What is this initiative about?", "");
  if (!about.trim()) {
    ctx.ui.notify("Cancelled", "info");
    return;
  }

  const goal = await ctx.ui.input("What is the intended goal?", "");
  if (!goal.trim()) {
    ctx.ui.notify("Cancelled", "info");
    return;
  }

  const suggestedName = suggestInitiativeName(about, goal);
  let initName = (await ctx.ui.input(
    "Initiative name (short kebab-case):",
    suggestedName
  )).trim();
  if (!initName) {
    ctx.ui.notify("Cancelled", "info");
    return;
  }

  if (!isValidKebabCase(initName)) {
    const suggestion = toKebabCase(initName);
    const ok = await ctx.ui.confirm(
      "Invalid name",
      `Name contains invalid characters. Use: ${suggestion}?`
    );
    if (!ok || !suggestion) return;
    initName = suggestion;
  }

  const initPath = join(INITIATIVES_DIR, initName);
  if (existsSync(initPath)) {
    ctx.ui.notify(`Initiative '${initName}' already exists`, "error");
    return;
  }

  const { metadata } = createWorkflowRecord(initPath, {
    name: initName,
    displayName: about.trim(),
    description: about.trim(),
    goal: goal.trim(),
    context: about.trim(),
    phase: "planning",
  });

  // This Pi process remains in its original directory. The new initiative is
  ctx.ui.notify(`✓ Initiative created: ${metadata.displayName}`, "success");

  const switchNow = await ctx.ui.confirm(
    "Switch to it now?",
    "Start a fresh Pi session in the new initiative, or stay in this conversation?"
  );

  if (switchNow) {
    await switchToInitiative(ctx, initPath, initName);
  } else {
    ctx.ui.notify(`When ready, run: forge launch ${initName}`, "info");
  }
}

function createInitiativeFolders(
  initPath: string,
  metadata: InitiativeMetadata
) {
  // Create directories
  mkdirSync(join(initPath, ".forge"), { recursive: true });
  mkdirSync(join(initPath, "sessions"), { recursive: true });
  mkdirSync(join(initPath, "planning", "milestones"), { recursive: true });
  mkdirSync(join(initPath, "docs"), { recursive: true });
  mkdirSync(join(initPath, "artifacts"), { recursive: true });

  // Create metadata.json
  writeFileSync(
    join(initPath, ".forge", "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );

  // Create empty sessions.log
  writeFileSync(join(initPath, ".forge", "sessions.log"), "");

  // Create .claude.md template
  const claudeMd = generateClaudeMd(metadata);
  writeFileSync(join(initPath, ".claude.md"), claudeMd);

  // Create README.md
  const readmeMd = generateReadmeMd(metadata);
  writeFileSync(join(initPath, "README.md"), readmeMd);

  // Create docs/DECISIONS.md template
  const decisionsMd = `# Architecture Decisions

## ADR-001: [Decision Title]

**Date:** ${new Date().toISOString().split("T")[0]}
**Status:** Proposed
**Author:** ${metadata.owner}

### Context
What is the issue we're addressing?

### Decision
What is the decision we're making?

### Rationale
Why are we choosing this option over alternatives?

### Consequences
What are the positive and negative impacts?

---
`;
  writeFileSync(join(initPath, "docs", "DECISIONS.md"), decisionsMd);

  // Create planning/ROADMAP.md template
  const roadmapMd = `# Roadmap: ${metadata.displayName}

## 📋 Milestone Overview

| Milestone | Timeline | Status |
|-----------|----------|--------|
| M1 | TBD | Not Started |

## 🔗 Dependency Graph

\`\`\`
M1 ──> M2
\`\`\`

## 📋 Milestone Details

### M1: [Name]
**Timeline:** TBD
**Deliverable:** [What gets delivered]
**Plan:** See \`milestones/m1-name.md\`

---
`;
  writeFileSync(join(initPath, "planning", "ROADMAP.md"), roadmapMd);
}

function generateClaudeMd(metadata: InitiativeMetadata): string {
  return `# Initiative: ${metadata.displayName}

## 📂 Quick Navigation
- **Roadmap:** \`planning/ROADMAP.md\` - Milestone index & dependencies
- **Milestones:** \`planning/milestones/\` - Focused execution plans
- **Decisions:** \`docs/DECISIONS.md\` - Architecture decision records
- **Sessions:** \`sessions/YYYY-MM-DD_name/\` - Work logs & notes
- **Documentation:** \`docs/\` - Specs, requirements, references
- **Artifacts:** \`artifacts/\` - Code, scripts, data, deliverables
- **Metadata:** \`.forge/metadata.json\` - Status & tracking

---

## 📋 Context

**What:** ${metadata.description}

**Goal:** ${metadata.goal}

**Status:** ${metadata.status} (${metadata.phase})
**Owner:** ${metadata.owner}
**Tags:** ${metadata.tags.join(", ") || "None"}
**Last Updated:** ${metadata.lastUpdated}

---

## 📅 Recent Activity

**Latest Session:** None yet

**Recent Progress:**
- Initiative created

**Next Steps:**
- [ ] Set up milestones
- [ ] Start first session

---

## 🚧 Current Blockers
- None

## ❓ Open Questions
- None

---

*Last updated: ${metadata.lastUpdated}*
`;
}

function generateReadmeMd(metadata: InitiativeMetadata): string {
  return `# ${metadata.displayName}

${metadata.description}

## Goal
${metadata.goal}

## Status
- **Status:** ${metadata.status}
- **Phase:** ${metadata.phase}
- **Owner:** ${metadata.owner}
- **Created:** ${metadata.created}

## Quick Links
- [Context & Navigation](./.claude.md)
- [Roadmap](./planning/ROADMAP.md)
- [Architecture Decisions](./docs/DECISIONS.md)
- [Sessions](./sessions/)

## Getting Started
1. Update the roadmap with milestones
2. Document architecture decisions in \`docs/DECISIONS.md\`
3. Start your first session: \`/forge\`

---
`;
}

async function createSessionFlow(
  initPath: string,
  metadata: InitiativeMetadata,
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI,
  allowPiRename = true
) {
  const sessionName =
    (await ctx.ui.input("Session name (kebab-case):", "")) || "work";
  if (!sessionName.trim()) {
    ctx.ui.notify("Cancelled", "info");
    return;
  }

  // Renaming is only meaningful when this Pi process is rooted in the
  // initiative being managed.
  if (allowPiRename) {
    const piSessionName = await ctx.ui.input("Pi session name (optional):", "");
    if (piSessionName.trim()) {
      pi.setSessionName(piSessionName);
    }
  }

  const { sessionFolder } = createWorkSession(initPath, metadata, sessionName);

  ctx.ui.notify(
    `✓ Session created: ${sessionFolder}\n\n📝 Start working!\nEdit: sessions/${sessionFolder}/notes.md`,
    "success"
  );
}

async function resumeSessionFlow(
  initPath: string,
  metadata: InitiativeMetadata,
  sessionName: string,
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI
) {
  const sessionPath = join(initPath, "sessions", sessionName);
  const notesPath = join(sessionPath, "notes.md");

  if (!existsSync(notesPath)) {
    ctx.ui.notify(`Session not found: ${sessionName}`, "error");
    return;
  }

  // Read session notes
  const notes = readFileSync(notesPath, "utf8");

  // Optionally name the Pi session
  const piSessionName = await ctx.ui.input("Pi session name (optional):", "");
  if (piSessionName.trim()) {
    pi.setSessionName(piSessionName);
  }

  // Update metadata
  metadata.lastSession = new Date().toISOString();
  metadata.lastUpdated = new Date().toISOString();
  writeFileSync(join(initPath, ".forge", "metadata.json"), JSON.stringify(metadata, null, 2));

  ctx.ui.notify(
    `▶️ Resumed: ${sessionName}\n\n${notes.substring(0, 300)}...\n\nFull notes in: sessions/${sessionName}/notes.md`,
    "success"
  );
}

async function updateStatusFlow(
  initPath: string,
  metadata: InitiativeMetadata,
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI
) {
  const statusOptions = ["🟢 Active", "⏸️ Paused", "🔴 Blocked", "✓ Completed"];
  const statusMap: { [key: string]: "active" | "paused" | "blocked" | "completed" } = {
    "🟢 Active": "active",
    "⏸️ Paused": "paused",
    "🔴 Blocked": "blocked",
    "✓ Completed": "completed",
  };

  const newStatusLabel = await ctx.ui.select("Status:", statusOptions);
  if (newStatusLabel) {
    const newStatus = statusMap[newStatusLabel];
    if (newStatus && newStatus !== metadata.status) {
      metadata.status = newStatus;
    }
  }

  // Get progress summary
  const progress =
    (await ctx.ui.input("Recent progress summary:", "")) || "";

  // If marking as completed, trigger completion workflow
  if (metadata.status === "completed") {
    const completionNotes = await ctx.ui.input(
      "Add completion notes (optional):",
      ""
    );
    
    // Set phase to complete
    metadata.phase = "complete";
    
    // Update metadata
    metadata.lastUpdated = new Date().toISOString();
    writeFileSync(join(initPath, ".forge", "metadata.json"), JSON.stringify(metadata, null, 2));
    
    // Generate completion file
    const completionPath = generateCompletionFile(initPath, metadata, completionNotes);
    ctx.ui.notify(
      `✓ Initiative completed\n\n📄 Summary saved to: .forge/completion.md`,
      "success"
    );
    return;
  }

  // Update metadata
  metadata.lastUpdated = new Date().toISOString();
  writeFileSync(join(initPath, ".forge", "metadata.json"), JSON.stringify(metadata, null, 2));

  // Update .claude.md with new status and progress
  const claudePath = join(initPath, ".claude.md");
  let claudeContent = readFileSync(claudePath, "utf8");
  claudeContent = claudeContent.replace(
    /\*\*Status:\*\*.*?\(.*?\)/,
    `**Status:** ${metadata.status} (${metadata.phase})`
  );
  claudeContent = claudeContent.replace(
    /\*\*Last Updated:\*\*.*?\n/,
    `**Last Updated:** ${metadata.lastUpdated}\n`
  );

  if (progress) {
    claudeContent = claudeContent.replace(
      /\*\*Recent Progress:\*\*\n([\s\S]*?)\n\n\*\*Next Steps:\*\*/,
      `**Recent Progress:**\n- ${progress}\n\n**Next Steps:**`
    );
  }

  writeFileSync(claudePath, claudeContent);

  ctx.ui.notify(`✓ Initiative updated`, "success");
}

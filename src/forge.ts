import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const INITIATIVES_DIR = "/Users/yvizcaya/Documents/fujitsu/initiatives";

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
        if (forgeState.activeInitiative) {
          ctx.ui.setStatus("forge", `🔨 ${forgeState.activeInitiative}`);
        }
        break;
      }
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

function ensureInitiativesDir() {
  if (!existsSync(INITIATIVES_DIR)) {
    mkdirSync(INITIATIVES_DIR, { recursive: true });
  }
}

function isValidKebabCase(name: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name);
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

async function mainWorkflow(
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI,
  forgeState: ForgeState
) {
  const initiatives = listInitiatives();

  // Build selection options with "create new" at top
  const createNewOption = "➕ Create new initiative";
  const initiativeOptions = [
    createNewOption,
    ...(initiatives.length > 0 ? ["─────────────────────────────"] : []),
    ...initiatives
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
      .map(
        (init) =>
          `${init.displayName.padEnd(25)} │ ${init.status.padEnd(10)} │ ${init.phase.padEnd(10)}`
      ),
  ];

  // Step 1: Select initiative
  const choice = await ctx.ui.select("🔨 Forge - What would you like to do?", initiativeOptions);
  if (!choice) return;

  // Handle create new initiative
  if (choice === createNewOption) {
    await createInitiativeFlow(ctx, pi, forgeState);
    return;
  }

  // Skip divider
  if (choice.startsWith("─")) {
    await mainWorkflow(ctx, pi, forgeState);
    return;
  }

  // Find selected initiative
  const selectedIndex = initiativeOptions.indexOf(choice);
  if (selectedIndex < 0) return;

  const sorted = [...initiatives].sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  );
  const selectedInitiative = sorted[selectedIndex - (initiatives.length > 0 ? 2 : 1)];

  if (!selectedInitiative) return;

  // Step 2: Show initiative summary
  const initPath = join(INITIATIVES_DIR, selectedInitiative.name);
  const metadata = readJSON<InitiativeMetadata>(join(initPath, ".worklog", "metadata.json"));

  ctx.ui.notify(
    `\n📂 ${metadata.displayName}\n   ${metadata.description}\n\n   Goal: ${metadata.goal}\n   Status: ${metadata.status} (${metadata.phase})\n   Sessions: ${metadata.sessionCount}`,
    "info"
  );

  // Update active state
  forgeState.activeInitiative = selectedInitiative.name;
  forgeState.lastUpdated = new Date().toISOString();
  pi.appendEntry("forge-state", forgeState);
  ctx.ui.setStatus("forge", `🔨 ${selectedInitiative.name}`);

  // Step 3: Get recent sessions
  const recentSessions = getRecentSessions(initPath);

  // Step 4: Action menu
  const actionOptions = [
    "➕ Create new session",
    ...(recentSessions.length > 0
      ? ["▶️ Resume session", ...recentSessions.slice(0, 5).map((s) => `     ${s}`)]
      : []),
    "⚙️ Update status",
    "🔄 Back to initiatives",
  ];

  const action = await ctx.ui.select("What would you like to do?", actionOptions);
  if (!action) return;

  if (action === "➕ Create new session") {
    await createSessionFlow(initPath, metadata, ctx, pi);
  } else if (action === "▶️ Resume session") {
    // Show selection of which session to resume
    const sessionChoice = await ctx.ui.select("Select session to resume:", recentSessions);
    if (sessionChoice) {
      await resumeSessionFlow(initPath, metadata, sessionChoice, ctx, pi);
    }
  } else if (action.includes("     ")) {
    // User selected a specific session from the recent list
    const sessionName = action.trim();
    await resumeSessionFlow(initPath, metadata, sessionName, ctx, pi);
  } else if (action === "⚙️ Update status") {
    await updateStatusFlow(initPath, metadata, ctx, pi);
  } else if (action === "🔄 Back to initiatives") {
    await mainWorkflow(ctx, pi, forgeState);
  }
}

async function createInitiativeFlow(
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI,
  forgeState: ForgeState
) {
  const name = await ctx.ui.input("Initiative name (kebab-case):", "");
  if (!name.trim()) {
    ctx.ui.notify("Cancelled", "info");
    return;
  }

  let initName = name.trim();

  // Validate kebab-case
  if (!isValidKebabCase(initName)) {
    const suggestion = toKebabCase(initName);
    const ok = await ctx.ui.confirm(
      "Invalid name",
      `Name contains invalid characters. Use: ${suggestion}?`
    );
    if (!ok) return;
    initName = suggestion;
  }

  // Check if already exists
  const initPath = join(INITIATIVES_DIR, initName);
  if (existsSync(initPath)) {
    ctx.ui.notify(`Initiative '${initName}' already exists`, "error");
    return;
  }

  // Gather details
  const displayName =
    (await ctx.ui.input("Display name (human-readable):", initName)) || initName;
  const description =
    (await ctx.ui.input("Brief description:", "")) || "No description";
  const goal =
    (await ctx.ui.input("Primary goal:", "")) || "To be defined";
  const tags = (
    (await ctx.ui.input("Tags (comma-separated):", "")) || ""
  )
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t);

  // Create folder structure
  const metadata: InitiativeMetadata = {
    name: initName,
    displayName,
    description,
    goal,
    status: "active",
    phase: "planning",
    created: new Date().toISOString(),
    lastSession: null,
    lastUpdated: new Date().toISOString(),
    owner: "yvizcaya",
    tags,
    sessionCount: 0,
    relatedInitiatives: [],
  };

  createInitiativeFolders(initPath, metadata);

  // Set as active
  forgeState.activeInitiative = initName;
  forgeState.lastUpdated = new Date().toISOString();
  pi.appendEntry("forge-state", forgeState);

  ctx.ui.setStatus("forge", `🔨 ${initName}`);
  ctx.ui.notify(`✓ Initiative created: ${displayName}`, "success");

  // Offer to create first session
  const startSession = await ctx.ui.confirm(
    "Create first session?",
    "Start working now?"
  );
  if (startSession) {
    await createSessionFlow(initPath, metadata, ctx, pi);
  }
}

function createInitiativeFolders(
  initPath: string,
  metadata: InitiativeMetadata
) {
  // Create directories
  mkdirSync(join(initPath, ".worklog"), { recursive: true });
  mkdirSync(join(initPath, "sessions"), { recursive: true });
  mkdirSync(join(initPath, "planning", "milestones"), { recursive: true });
  mkdirSync(join(initPath, "docs"), { recursive: true });
  mkdirSync(join(initPath, "artifacts"), { recursive: true });

  // Create metadata.json
  writeFileSync(
    join(initPath, ".worklog", "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );

  // Create empty sessions.log
  writeFileSync(join(initPath, ".worklog", "sessions.log"), "");

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
- **Metadata:** \`.worklog/metadata.json\` - Status & tracking

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
  pi: ExtensionAPI
) {
  const sessionName =
    (await ctx.ui.input("Session name (kebab-case):", "")) || "work";
  if (!sessionName.trim()) {
    ctx.ui.notify("Cancelled", "info");
    return;
  }

  // Optionally name the Pi session
  const piSessionName = await ctx.ui.input("Pi session name (optional):", "");
  if (piSessionName.trim()) {
    pi.setSessionName(piSessionName);
  }

  const sessionDate = new Date().toISOString().split("T")[0];
  const sessionFolder = `${sessionDate}_${sessionName.replace(/\s+/g, "-").toLowerCase()}`;
  const sessionPath = join(initPath, "sessions", sessionFolder);

  mkdirSync(sessionPath, { recursive: true });

  // Create session notes template
  const notesTemplate = `# Session: ${sessionName}

**Date:** ${sessionDate}
**Milestone:** M# (if applicable)
**Goal:** [Session goal]

## What Was Done
- [Accomplishment 1]

## Architecture Decisions Made
- [Any decisions]

## Artifacts Created
- None yet

## Next Session
- [ ] [Task 1]

## Blockers/Questions
- None
`;

  writeFileSync(join(sessionPath, "notes.md"), notesTemplate);

  // Update metadata
  metadata.lastSession = new Date().toISOString();
  metadata.sessionCount += 1;
  metadata.lastUpdated = new Date().toISOString();
  writeFileSync(join(initPath, ".worklog", "metadata.json"), JSON.stringify(metadata, null, 2));

  // Append to sessions.log
  const logEntry = `${new Date().toISOString()} | ${sessionFolder} | Session created\n`;
  execSync(
    `echo '${logEntry}' >> '${join(initPath, ".worklog", "sessions.log")}'`
  );

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
  writeFileSync(join(initPath, ".worklog", "metadata.json"), JSON.stringify(metadata, null, 2));

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

  // Update metadata
  metadata.lastUpdated = new Date().toISOString();
  writeFileSync(join(initPath, ".worklog", "metadata.json"), JSON.stringify(metadata, null, 2));

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

function listInitiatives(): InitiativeMetadata[] {
  if (!existsSync(INITIATIVES_DIR)) return [];

  const dirents = execSync(`ls -d ${INITIATIVES_DIR}/*/ 2>/dev/null || true`, {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((line) => line);

  return dirents
    .map((dir) => {
      const metadataPath = join(dir, ".worklog", "metadata.json");
      if (existsSync(metadataPath)) {
        return readJSON<InitiativeMetadata>(metadataPath);
      }
      return null;
    })
    .filter((m): m is InitiativeMetadata => m !== null);
}

function getRecentSessions(initPath: string): string[] {
  const sessionsDir = join(initPath, "sessions");
  if (!existsSync(sessionsDir)) return [];

  const sessions = execSync(`ls -d ${sessionsDir}/*/ 2>/dev/null || true`, {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((line) => line)
    .map((dir) => dir.split("/").filter((p) => p).pop() || "")
    .filter((name) => name);

  // Sort by date (newest first)
  return sessions.sort().reverse();
}

function readJSON<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8"));
}

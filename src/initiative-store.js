const {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} = require("node:fs");
const { join, relative, sep } = require("node:path");

const WORKFLOW_SCHEMA_VERSION = 2;
const WORKFLOW_DOCUMENTS = {
  brief: "brief.md",
  memory: "memory.md",
  outputs: "outputs/",
};
const WORKFLOW_READ_ORDER = [WORKFLOW_DOCUMENTS.brief, WORKFLOW_DOCUMENTS.memory];
const WORKFLOW_STATUSES = ["active", "paused", "blocked", "completed"];
const WORKFLOW_PHASES = ["planning", "execution", "review", "complete"];
const FORGE_CONTEXT_PATTERN = /^<!-- forge-context\s*\n([\s\S]*?)\n-->\s*/;

function expandPath(value) {
  return value.startsWith("~")
    ? value.replace("~", process.env.HOME || "")
    : value;
}

const INITIATIVES_DIR = expandPath(
  process.env.FORGE_INITIATIVES_DIR || "~/Documents/initiatives"
);

function ensureInitiativesDir() {
  if (!existsSync(INITIATIVES_DIR)) mkdirSync(INITIATIVES_DIR, { recursive: true });
}

function readJSON(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function listInitiatives() {
  if (!existsSync(INITIATIVES_DIR)) return [];

  return readdirSync(INITIATIVES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(INITIATIVES_DIR, entry.name, ".forge", "metadata.json"))
    .filter(existsSync)
    .map(readJSON);
}

function getRecentSessions(initPath) {
  const sessionsDir = join(initPath, "sessions");
  if (!existsSync(sessionsDir)) return [];

  return readdirSync(sessionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
}

function formatInitiativeLabel(initiative, activeName = null) {
  const marker = initiative.name === activeName ? "🔨 " : "📂 ";
  const sessionCount = Number(initiative.sessionCount) || 0;
  const sessionLabel = `${sessionCount} session${sessionCount === 1 ? "" : "s"}`;
  return `${marker}${initiative.displayName} · ${initiative.status}/${initiative.phase} · ${sessionLabel} · ${initiative.name}`;
}

function formatTimestamp(value, fallback = "Never") {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatInitiativeSummary(initiative, recentSessions = [], activeName = null) {
  const sessionCount = Number(initiative.sessionCount) || 0;
  const sessionLabel = `${sessionCount} session${sessionCount === 1 ? "" : "s"}`;
  const tags = initiative.tags?.length ? initiative.tags.join(", ") : "None";
  const recent = recentSessions.slice(0, 3);
  const recentLabel = recent.length ? recent.map((session) => `• ${session}`).join("\n") : "• No sessions yet";
  const active = initiative.name === activeName ? " · ACTIVE" : "";

  return [
    `📂 ${initiative.displayName}${active}`,
    `   ${initiative.name}`,
    "",
    `🟢 Status: ${initiative.status} · ${initiative.phase}`,
    `🎯 Goal: ${initiative.goal || "To be defined"}`,
    `📝 About: ${initiative.description || "No description"}`,
    "",
    `👤 Owner: ${initiative.owner || "Unassigned"}`,
    `🏷️ Tags: ${tags}`,
    `🗓️ Created: ${formatTimestamp(initiative.created)}`,
    `🕒 Last activity: ${formatTimestamp(initiative.lastUpdated)}`,
    `📚 ${sessionLabel} · Last session: ${formatTimestamp(initiative.lastSession)}`,
    "",
    "🗂️ Recent sessions:",
    recentLabel,
  ].join("\n");
}

function createInitiative(initPath, metadata) {
  mkdirSync(join(initPath, ".forge"), { recursive: true });
  mkdirSync(join(initPath, "sessions"), { recursive: true });
  mkdirSync(join(initPath, "planning", "milestones"), { recursive: true });
  mkdirSync(join(initPath, "docs"), { recursive: true });
  mkdirSync(join(initPath, "artifacts"), { recursive: true });

  writeFileSync(join(initPath, ".forge", "metadata.json"), JSON.stringify(metadata, null, 2));
  writeFileSync(join(initPath, ".forge", "sessions.log"), "");

  writeFileSync(
    join(initPath, ".claude.md"),
    `# Initiative: ${metadata.displayName}

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
`
  );

  writeFileSync(
    join(initPath, "README.md"),
    `# ${metadata.displayName}

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
`
  );

  writeFileSync(
    join(initPath, "docs", "DECISIONS.md"),
    `# Architecture Decisions

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
`
  );

  writeFileSync(
    join(initPath, "planning", "ROADMAP.md"),
    `# Roadmap: ${metadata.displayName}

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
`
  );
}

function createWorkSession(initPath, metadata, sessionName) {
  const normalizedName = sessionName.trim().replace(/\s+/g, "-").toLowerCase();
  if (!normalizedName) throw new Error("A session name is required");

  const sessionDate = new Date().toISOString().split("T")[0];
  const sessionFolder = `${sessionDate}_${normalizedName}`;
  const sessionPath = join(initPath, "sessions", sessionFolder);
  if (existsSync(sessionPath)) {
    throw new Error(`Session already exists: ${sessionFolder}`);
  }

  mkdirSync(sessionPath, { recursive: true });
  writeFileSync(
    join(sessionPath, "notes.md"),
    `# Session: ${sessionName}

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
`
  );

  const now = new Date().toISOString();
  metadata.lastSession = now;
  metadata.sessionCount = (metadata.sessionCount || 0) + 1;
  metadata.lastUpdated = now;
  writeFileSync(
    join(initPath, ".forge", "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );
  appendFileSync(
    join(initPath, ".forge", "sessions.log"),
    `${now} | ${sessionFolder} | Session created\n`
  );

  return { sessionFolder, sessionPath };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asStringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function writeFileAtomically(path, content) {
  const temporaryPath = `${path}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    writeFileSync(temporaryPath, content, "utf8");
    renameSync(temporaryPath, path);
  } finally {
    if (existsSync(temporaryPath)) {
      try {
        unlinkSync(temporaryPath);
      } catch {
        // Preserve the original write error if cleanup also fails.
      }
    }
  }
}

function createForgeContextDocument(context, body = "") {
  if (!isPlainObject(context) || typeof context.type !== "string") {
    throw new Error("A Forge document context with a type is required");
  }

  return [
    "<!-- forge-context",
    JSON.stringify(context),
    "-->",
    "",
    body.trim(),
    "",
  ].join("\n");
}

function parseForgeContextDocument(content, expectedType) {
  if (typeof content !== "string") throw new Error("Forge document content must be text");

  const match = content.match(FORGE_CONTEXT_PATTERN);
  if (!match) throw new Error("Missing forge-context JSON block");

  let context;
  try {
    context = JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`Invalid forge-context JSON: ${error.message}`);
  }

  if (!isPlainObject(context) || context.type !== expectedType) {
    throw new Error(`Expected Forge document type '${expectedType}'`);
  }
  if (context.version !== 1) {
    throw new Error(`Unsupported Forge document version: ${context.version}`);
  }

  return {
    context,
    body: content.slice(match[0].length).trim(),
  };
}

function validateWorkflowDocumentPath(documentPath, kind) {
  if (typeof documentPath !== "string" || documentPath.includes("\0")) {
    throw new Error(`Invalid Forge ${kind} document path`);
  }

  const normalized = documentPath.replaceAll("\\", "/");
  const expected = WORKFLOW_DOCUMENTS[kind];
  if (kind === "outputs") {
    if (normalized !== "outputs/" && normalized !== "outputs") {
      throw new Error(`Forge ${kind} path must be outputs/`);
    }
  } else if (normalized !== expected) {
    throw new Error(`Forge ${kind} path must be ${expected}`);
  }

  return normalized;
}

function resolveWorkflowDocumentPath(initPath, documentPath, kind) {
  const normalized = validateWorkflowDocumentPath(documentPath, kind);
  const path = join(initPath, normalized);
  const escape = relative(initPath, path);
  if (escape === ".." || escape.startsWith(`..${sep}`)) {
    throw new Error(`Forge ${kind} document path escapes the initiative`);
  }
  return path;
}

function createWorkflowMetadata(input, briefContext, memoryContext) {
  if (!isPlainObject(input) || !input.name) {
    throw new Error("Initiative name is required");
  }
  if (!isPlainObject(briefContext) || briefContext.type !== "forge/brief") {
    throw new Error("A valid Forge brief context is required");
  }
  if (!isPlainObject(memoryContext) || memoryContext.type !== "forge/memory") {
    throw new Error("A valid Forge memory context is required");
  }

  const now = new Date().toISOString();
  const metadata = {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    name: input.name,
    displayName: input.displayName || input.name,
    description: input.description || briefContext.outcome || "No description",
    goal: input.goal || briefContext.outcome || "To be defined",
    status: input.status || "active",
    phase: input.phase || "planning",
    created: input.created || now,
    lastSession: input.lastSession || null,
    lastUpdated: now,
    owner: input.owner || process.env.USER || "Unassigned",
    tags: asStringList(input.tags),
    sessionCount: Number(input.sessionCount) || 0,
    relatedInitiatives: asStringList(input.relatedInitiatives),
    documents: { ...WORKFLOW_DOCUMENTS },
    agent: {
      readOrder: [...WORKFLOW_READ_ORDER],
      nextAction: memoryContext.nextAction || "Define the next action.",
      affectedPaths: asStringList(briefContext.affectedPaths),
    },
  };

  return validateWorkflowMetadata(metadata);
}

function validateWorkflowMetadata(metadata) {
  if (!isPlainObject(metadata) || metadata.schemaVersion !== WORKFLOW_SCHEMA_VERSION) {
    throw new Error(`Forge metadata schemaVersion ${WORKFLOW_SCHEMA_VERSION} is required`);
  }
  if (typeof metadata.name !== "string" || !metadata.name.trim()) {
    throw new Error("Forge metadata name is required");
  }
  if (!WORKFLOW_STATUSES.includes(metadata.status)) {
    throw new Error(`Invalid Forge workflow status: ${metadata.status}`);
  }
  if (!WORKFLOW_PHASES.includes(metadata.phase)) {
    throw new Error(`Invalid Forge workflow phase: ${metadata.phase}`);
  }
  if (!isPlainObject(metadata.documents)) throw new Error("Forge metadata documents are required");
  validateWorkflowDocumentPath(metadata.documents.brief, "brief");
  validateWorkflowDocumentPath(metadata.documents.memory, "memory");
  validateWorkflowDocumentPath(metadata.documents.outputs, "outputs");

  if (!isPlainObject(metadata.agent)) throw new Error("Forge metadata agent index is required");
  if (!Array.isArray(metadata.agent.readOrder) ||
      metadata.agent.readOrder.length !== WORKFLOW_READ_ORDER.length ||
      metadata.agent.readOrder.some((path, index) => path !== WORKFLOW_READ_ORDER[index])) {
    throw new Error("Forge metadata agent.readOrder must be [brief.md, memory.md]");
  }
  metadata.agent.readOrder.forEach((path) => {
    if (path === metadata.documents.brief) validateWorkflowDocumentPath(path, "brief");
    else if (path === metadata.documents.memory) validateWorkflowDocumentPath(path, "memory");
    else throw new Error(`Unsupported Forge read-order path: ${path}`);
  });
  if (typeof metadata.agent.nextAction !== "string") {
    throw new Error("Forge metadata agent.nextAction must be a string");
  }
  if (!Array.isArray(metadata.agent.affectedPaths) ||
      metadata.agent.affectedPaths.some((path) => typeof path !== "string")) {
    throw new Error("Forge metadata agent.affectedPaths must be a string array");
  }

  return metadata;
}

function createWorkflowRecord(initPath, input = {}) {
  const now = new Date().toISOString();
  const briefContext = {
    type: "forge/brief",
    version: 1,
    outcome: input.outcome || input.goal || "To be defined",
    definitionOfDone: asStringList(input.definitionOfDone),
    context: input.context || "",
    scope: isPlainObject(input.scope) ? input.scope : { in: [], out: [] },
    constraints: asStringList(input.constraints),
    affectedPaths: asStringList(input.affectedPaths),
  };
  const memoryContext = {
    type: "forge/memory",
    version: 1,
    updated: now,
    status: input.status || "active",
    nextAction: input.nextAction || "Define the next action.",
    blockers: asStringList(input.blockers),
    openQuestions: asStringList(input.openQuestions),
    decisions: Array.isArray(input.decisions) ? input.decisions : [],
  };
  const metadata = createWorkflowMetadata(input, briefContext, memoryContext);
  const briefPath = resolveWorkflowDocumentPath(initPath, metadata.documents.brief, "brief");
  const memoryPath = resolveWorkflowDocumentPath(initPath, metadata.documents.memory, "memory");
  const outputsPath = resolveWorkflowDocumentPath(initPath, metadata.documents.outputs, "outputs");
  const metadataPath = join(initPath, ".forge", "metadata.json");

  mkdirSync(join(initPath, ".forge"), { recursive: true });
  mkdirSync(outputsPath, { recursive: true });
  writeFileAtomically(join(initPath, ".forge", "sessions.log"), "");
  writeFileAtomically(briefPath, createForgeContextDocument(briefContext, "# Brief"));
  writeFileAtomically(memoryPath, createForgeContextDocument(memoryContext, "# Memory"));
  writeFileAtomically(metadataPath, JSON.stringify(metadata, null, 2));

  return { metadata, brief: briefContext, memory: memoryContext };
}

function readWorkflowRecord(initPath) {
  const metadataPath = join(initPath, ".forge", "metadata.json");
  const metadata = validateWorkflowMetadata(readJSON(metadataPath));
  const briefPath = resolveWorkflowDocumentPath(initPath, metadata.documents.brief, "brief");
  const memoryPath = resolveWorkflowDocumentPath(initPath, metadata.documents.memory, "memory");
  const brief = parseForgeContextDocument(readFileSync(briefPath, "utf8"), "forge/brief");
  const memory = parseForgeContextDocument(readFileSync(memoryPath, "utf8"), "forge/memory");

  return { metadata, brief, memory, paths: { metadata: metadataPath, brief: briefPath, memory: memoryPath } };
}

function updateWorkflowMemory(initPath, updates = {}) {
  const record = readWorkflowRecord(initPath);
  const now = new Date().toISOString();
  const { body = record.memory.body, ...contextUpdates } = updates;
  const memory = {
    ...record.memory.context,
    ...contextUpdates,
    type: "forge/memory",
    version: 1,
    updated: now,
  };
  writeFileAtomically(record.paths.memory, createForgeContextDocument(memory, body));

  const metadata = {
    ...record.metadata,
    lastUpdated: now,
    agent: {
      ...record.metadata.agent,
      nextAction: memory.nextAction || "Define the next action.",
    },
  };
  validateWorkflowMetadata(metadata);
  writeFileAtomically(record.paths.metadata, JSON.stringify(metadata, null, 2));
  return { metadata, memory };
}

function updateWorkflowBrief(initPath, updates = {}) {
  const record = readWorkflowRecord(initPath);
  const now = new Date().toISOString();
  const { body = record.brief.body, ...contextUpdates } = updates;
  const brief = {
    ...record.brief.context,
    ...contextUpdates,
    type: "forge/brief",
    version: 1,
  };
  writeFileAtomically(record.paths.brief, createForgeContextDocument(brief, body));

  const metadata = {
    ...record.metadata,
    lastUpdated: now,
    agent: {
      ...record.metadata.agent,
      affectedPaths: asStringList(brief.affectedPaths),
    },
  };
  validateWorkflowMetadata(metadata);
  writeFileAtomically(record.paths.metadata, JSON.stringify(metadata, null, 2));
  return { metadata, brief };
}

function readOptionalText(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function extractMarkdownSection(content, heading) {
  if (!content) return "";
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`^#{1,6}\\s+${escaped}\\s*$\\n([\\s\\S]*?)(?=^#{1,6}\\s|(?![\\s\\S]))`, "im"));
  return match ? match[1].trim() : "";
}

function extractUsefulList(content) {
  return content
    .split("\n")
    .map((line) => line.replace(/^\s*[-*]\s*(?:\[[ xX]\]\s*)?/, "").trim())
    .filter((line) => line && !/^\[.*\]$/.test(line) && !/^(none|none yet|tbd)$/i.test(line));
}

function firstUsefulValue(...values) {
  return values.find((value) => typeof value === "string" && value.trim() &&
    !/^(to be defined|no description|tbd)$/i.test(value.trim()))?.trim() || "To be defined";
}

function normalizeWorkflowStatus(status) {
  return WORKFLOW_STATUSES.includes(status) ? status : "active";
}

function normalizeWorkflowPhase(phase, status) {
  if (status === "completed") return "complete";
  return WORKFLOW_PHASES.includes(phase) ? phase : "planning";
}

function findLegacySources(initPath) {
  const candidates = [
    "README.md",
    ".claude.md",
    "planning/ROADMAP.md",
    "docs/DECISIONS.md",
  ];
  const recentSession = getRecentSessions(initPath)
    .map((session) => `sessions/${session}/notes.md`)
    .find((path) => existsSync(join(initPath, path)));
  if (recentSession) candidates.push(recentSession);
  return candidates.filter((path) => existsSync(join(initPath, path)));
}

function parseExistingWorkflowDocument(path, type, label, conflicts) {
  if (!existsSync(path)) return null;
  try {
    return parseForgeContextDocument(readFileSync(path, "utf8"), type);
  } catch {
    conflicts.push(`${label} exists but is not a valid ${type} document`);
    return null;
  }
}

function isWorkflowInitiative(initPath) {
  try {
    readWorkflowRecord(initPath);
    return true;
  } catch {
    return false;
  }
}

function planLegacyMigration(initPath) {
  const metadataPath = join(initPath, ".forge", "metadata.json");
  if (!existsSync(metadataPath)) throw new Error("Legacy initiative metadata was not found");

  const legacyMetadata = readJSON(metadataPath);
  if (!isPlainObject(legacyMetadata) || typeof legacyMetadata.name !== "string") {
    throw new Error("Legacy initiative metadata is malformed or has no name");
  }

  if (isWorkflowInitiative(initPath)) {
    return {
      initiativeName: legacyMetadata.name,
      alreadyCurrent: true,
      canMigrate: false,
      conflicts: [],
      warnings: ["Initiative already uses the Forge workflow record."],
      sources: [],
      creates: [],
      preserves: [],
    };
  }

  const conflicts = [];
  const warnings = [];
  const sources = findLegacySources(initPath);
  const briefPath = join(initPath, WORKFLOW_DOCUMENTS.brief);
  const memoryPath = join(initPath, WORKFLOW_DOCUMENTS.memory);
  const existingBrief = parseExistingWorkflowDocument(
    briefPath,
    "forge/brief",
    WORKFLOW_DOCUMENTS.brief,
    conflicts
  );
  const existingMemory = parseExistingWorkflowDocument(
    memoryPath,
    "forge/memory",
    WORKFLOW_DOCUMENTS.memory,
    conflicts
  );

  const readme = readOptionalText(join(initPath, "README.md"));
  const claude = readOptionalText(join(initPath, ".claude.md"));
  const recentSessionPath = sources.find((path) => path.startsWith("sessions/"));
  const recentSession = recentSessionPath ? readOptionalText(join(initPath, recentSessionPath)) : "";
  const title = readme.match(/^#\s+(.+)$/m)?.[1]?.trim() || legacyMetadata.displayName;
  const outcome = firstUsefulValue(
    legacyMetadata.goal,
    extractMarkdownSection(readme, "Goal"),
    legacyMetadata.description,
    title
  );
  const context = firstUsefulValue(
    legacyMetadata.description,
    extractMarkdownSection(claude, "Context"),
    extractMarkdownSection(readme, "Overview")
  );
  const definitionOfDone = extractUsefulList(
    extractMarkdownSection(readme, "Definition of Done")
  );
  const progress = extractUsefulList(extractMarkdownSection(recentSession, "What Was Done"));
  const nextTasks = extractUsefulList(extractMarkdownSection(recentSession, "Next Session"));
  const blockers = extractUsefulList(extractMarkdownSection(recentSession, "Blockers/Questions"));
  const nextAction = nextTasks[0] || "Review migrated context and choose the next action.";
  const openQuestions = [
    "Review the migrated brief and memory for missing or ambiguous legacy context.",
  ];
  if (outcome === "To be defined") openQuestions.push("Define the initiative outcome.");
  if (definitionOfDone.length === 0) openQuestions.push("Define what makes this initiative done.");

  const now = new Date().toISOString();
  const status = normalizeWorkflowStatus(legacyMetadata.status);
  const briefContext = existingBrief?.context || {
    type: "forge/brief",
    version: 1,
    outcome,
    definitionOfDone,
    context: context === "To be defined" ? "" : context,
    scope: { in: [], out: [] },
    constraints: [],
    affectedPaths: asStringList(legacyMetadata.agent?.affectedPaths),
    migratedFrom: sources,
  };
  const memoryContext = existingMemory?.context || {
    type: "forge/memory",
    version: 1,
    updated: now,
    status,
    progress,
    nextAction,
    blockers,
    openQuestions,
    decisions: [],
    migratedFrom: sources,
  };
  const metadata = createWorkflowMetadata({
    ...legacyMetadata,
    status,
    phase: normalizeWorkflowPhase(legacyMetadata.phase, status),
    displayName: legacyMetadata.displayName || title || legacyMetadata.name,
    description: legacyMetadata.description || context,
    goal: outcome,
  }, briefContext, memoryContext);
  metadata.migration = {
    fromSchemaVersion: legacyMetadata.schemaVersion || 1,
    plannedAt: now,
    sources,
  };

  if (sources.length === 0) {
    warnings.push("No legacy Markdown sources were found; migration relies on metadata only.");
  }
  if (existingBrief) warnings.push("Existing valid brief.md will be preserved.");
  if (existingMemory) warnings.push("Existing valid memory.md will be preserved.");

  return {
    initiativeName: legacyMetadata.name,
    alreadyCurrent: false,
    canMigrate: conflicts.length === 0,
    conflicts,
    warnings,
    sources,
    creates: [
      ...(existingBrief ? [] : [WORKFLOW_DOCUMENTS.brief]),
      ...(existingMemory ? [] : [WORKFLOW_DOCUMENTS.memory]),
      ...(!existsSync(join(initPath, WORKFLOW_DOCUMENTS.outputs)) ? [WORKFLOW_DOCUMENTS.outputs] : []),
      ...(!existsSync(join(initPath, ".forge", "sessions.log")) ? [".forge/sessions.log"] : []),
    ],
    preserves: sources,
    preview: {
      legacyMetadata,
      metadata,
      brief: { context: briefContext, body: "# Brief\n\nReview this migrated brief before relying on it." },
      memory: { context: memoryContext, body: "# Memory\n\n## Migration\n\nReview required: this context was derived from legacy Forge records." },
      existingBrief: Boolean(existingBrief),
      existingMemory: Boolean(existingMemory),
    },
  };
}

function nextMigrationBackupPath(initPath) {
  const forgePath = join(initPath, ".forge");
  const base = join(forgePath, "metadata.pre-v2.json");
  if (!existsSync(base)) return base;

  let counter = 2;
  while (existsSync(join(forgePath, `metadata.pre-v2-${counter}.json`))) counter += 1;
  return join(forgePath, `metadata.pre-v2-${counter}.json`);
}

function applyLegacyMigration(initPath) {
  const plan = planLegacyMigration(initPath);
  if (plan.alreadyCurrent) throw new Error("Initiative already uses the Forge workflow record");
  if (!plan.canMigrate) {
    throw new Error(`Migration blocked: ${plan.conflicts.join("; ")}`);
  }

  const metadataPath = join(initPath, ".forge", "metadata.json");
  const backupPath = nextMigrationBackupPath(initPath);
  writeFileAtomically(backupPath, readFileSync(metadataPath, "utf8"));
  mkdirSync(join(initPath, WORKFLOW_DOCUMENTS.outputs), { recursive: true });
  const sessionsLogPath = join(initPath, ".forge", "sessions.log");
  if (!existsSync(sessionsLogPath)) writeFileAtomically(sessionsLogPath, "");

  if (!plan.preview.existingBrief) {
    writeFileAtomically(
      join(initPath, WORKFLOW_DOCUMENTS.brief),
      createForgeContextDocument(plan.preview.brief.context, plan.preview.brief.body)
    );
  }
  if (!plan.preview.existingMemory) {
    writeFileAtomically(
      join(initPath, WORKFLOW_DOCUMENTS.memory),
      createForgeContextDocument(plan.preview.memory.context, plan.preview.memory.body)
    );
  }

  const metadata = {
    ...plan.preview.metadata,
    migration: {
      ...plan.preview.metadata.migration,
      migratedAt: new Date().toISOString(),
    },
  };
  delete metadata.migration.plannedAt;
  validateWorkflowMetadata(metadata);
  writeFileAtomically(metadataPath, JSON.stringify(metadata, null, 2));
  return { metadata, backupPath, created: plan.creates, preserved: plan.preserves };
}

function formatMigrationPlan(plan) {
  if (plan.alreadyCurrent) return `✓ ${plan.initiativeName} already uses workflow schema v2.`;
  const lines = [
    `🔄 Migration preview: ${plan.initiativeName}`,
    `Status: ${plan.canMigrate ? "ready" : "blocked"}`,
    `Create: ${plan.creates.length ? plan.creates.join(", ") : "no new workflow files"}`,
    `Preserve: ${plan.preserves.length ? plan.preserves.join(", ") : "metadata only"}`,
    "Backup: .forge/metadata.pre-v2*.json",
  ];
  if (plan.preview) {
    lines.push(`Outcome: ${plan.preview.brief.context.outcome}`);
    lines.push(`Next action: ${plan.preview.memory.context.nextAction}`);
  }
  if (plan.warnings.length) lines.push(`Warnings: ${plan.warnings.join(" | ")}`);
  if (plan.conflicts.length) lines.push(`Conflicts: ${plan.conflicts.join(" | ")}`);
  return lines.join("\n");
}

module.exports = {
  INITIATIVES_DIR,
  ensureInitiativesDir,
  readJSON,
  listInitiatives,
  getRecentSessions,
  formatInitiativeLabel,
  formatInitiativeSummary,
  createInitiative,
  createWorkSession,
  createForgeContextDocument,
  parseForgeContextDocument,
  createWorkflowMetadata,
  validateWorkflowMetadata,
  createWorkflowRecord,
  readWorkflowRecord,
  updateWorkflowMemory,
  updateWorkflowBrief,
  isWorkflowInitiative,
  planLegacyMigration,
  applyLegacyMigration,
  formatMigrationPlan,
};

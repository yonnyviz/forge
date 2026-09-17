const {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} = require("node:fs");
const { join } = require("node:path");

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
};

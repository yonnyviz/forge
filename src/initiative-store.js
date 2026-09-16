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
  createWorkSession,
};

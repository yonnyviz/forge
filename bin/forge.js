#!/usr/bin/env node

const { spawn } = require("node:child_process");
const { createInterface } = require("node:readline/promises");
const { homedir } = require("node:os");
const { stdin, stdout } = require("node:process");
const { join, resolve } = require("node:path");
const { existsSync, readFileSync, readdirSync, statSync } = require("node:fs");
const {
  INITIATIVES_DIR,
  createInitiative,
  createWorkSession,
  ensureInitiativesDir,
  formatInitiativeLabel,
  formatInitiativeSummary,
  getRecentSessions,
  listInitiatives,
} = require("../src/initiative-store.js");

function getPiSessionDir(cwd) {
  const sessionRoot =
    process.env.PI_CODING_AGENT_SESSION_DIR ||
    join(process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"), "sessions");
  const safePath = `--${resolve(cwd).replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
  return join(sessionRoot, safePath);
}

function findNamedPiSession(cwd, name) {
  const sessionDir = getPiSessionDir(cwd);
  if (!existsSync(sessionDir)) return undefined;

  return readdirSync(sessionDir)
    .filter((entry) => entry.endsWith(".jsonl"))
    .map((entry) => join(sessionDir, entry))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
    .find((sessionPath) => {
      return readFileSync(sessionPath, "utf8").split("\n").some((line) => {
        try {
          const entry = JSON.parse(line);
          return entry.type === "session_info" && entry.name === name;
        } catch {
          return false;
        }
      });
    });
}

function toKebabCase(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

async function createInitiativeFlow(rl) {
  const requestedName = await rl.question("Initiative name (kebab-case): ");
  const initName = toKebabCase(requestedName);
  if (!initName) throw new Error("An initiative name is required");
  if (initName !== requestedName.trim()) {
    stdout.write(`Using: ${initName}\n`);
  }

  const initPath = join(INITIATIVES_DIR, initName);
  if (existsSync(initPath)) throw new Error(`Initiative '${initName}' already exists`);

  const displayName = (await rl.question(`Display name [${initName}]: `)).trim() || initName;
  const description = (await rl.question("Brief description [No description]: ")).trim() || "No description";
  const goal = (await rl.question("Primary goal [To be defined]: ")).trim() || "To be defined";
  const tags = (await rl.question("Tags (comma-separated) [none]: "))
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const now = new Date().toISOString();
  const metadata = {
    name: initName,
    displayName,
    description,
    goal,
    status: "active",
    phase: "planning",
    created: now,
    lastSession: null,
    lastUpdated: now,
    owner: process.env.USER || "Unassigned",
    tags,
    sessionCount: 0,
    relatedInitiatives: [],
  };

  createInitiative(initPath, metadata);
  stdout.write(`✓ Initiative created: ${displayName}\n`);
  return metadata;
}

async function main() {
  ensureInitiativesDir();
  const initiatives = listInitiatives().sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  );

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    stdout.write("\n🔨 Forge · Choose an initiative\n");
    stdout.write("1. ➕ Create new initiative\n");
    initiatives.forEach((initiative, index) => {
      stdout.write(`${index + 2}. ${formatInitiativeLabel(initiative)}\n`);
    });

    const selected = await rl.question("\nChoose an initiative: ");
    const selection = Number.parseInt(selected, 10);
    let initiative;

    if (selection === 1) {
      initiative = await createInitiativeFlow(rl);
    } else {
      const index = selection - 2;
      if (!Number.isInteger(index) || !initiatives[index]) {
        throw new Error("Choose a listed initiative number");
      }
      initiative = initiatives[index];
    }

    const initiativePath = join(INITIATIVES_DIR, initiative.name);
    const existingSessions = getRecentSessions(initiativePath);
    let sessionFolder;

    stdout.write(`\n${formatInitiativeSummary(initiative, existingSessions)}\n`);

    if (existingSessions.length === 0) {
      stdout.write("\nNo sessions yet. Starting a new session.\n");
      const sessionName = await rl.question("Session name [work]: ");
      const name = sessionName.trim() || "work";
      ({ sessionFolder } = createWorkSession(initiativePath, initiative, name));
      stdout.write(`✓ Created Forge session: ${sessionFolder}\n`);
    } else {
      stdout.write("\nWhat next?\n1. ➕ Start a new session\n2. ▶️ Resume a recent session\n");
      const action = await rl.question("Choose an action [1]: ");

      if (action.trim() === "2") {
        existingSessions.forEach((session, sessionIndex) => {
          stdout.write(`${sessionIndex + 1}. ${session}\n`);
        });
        const selectedSession = await rl.question("Select session to resume: ");
        const sessionIndex = Number.parseInt(selectedSession, 10) - 1;
        if (!Number.isInteger(sessionIndex) || !existingSessions[sessionIndex]) {
          throw new Error("Choose a listed session number");
        }
        sessionFolder = existingSessions[sessionIndex];
        stdout.write(`✓ Resuming Forge session: ${sessionFolder}\n`);
      } else {
        const sessionName = await rl.question("Session name [work]: ");
        const name = sessionName.trim() || "work";
        ({ sessionFolder } = createWorkSession(initiativePath, initiative, name));
        stdout.write(`✓ Created Forge session: ${sessionFolder}\n`);
      }
    }

    const piSessionName = `${initiative.name} — ${sessionFolder}`;

    stdout.write(`🏷️ Pi session: ${piSessionName}\n`);
    stdout.write(`🚀 Starting Pi in ${initiativePath}\n\n`);

    const piBin = process.env.FORGE_PI_BIN || "pi";
    const existingPiSession = findNamedPiSession(initiativePath, piSessionName);
    const piArgs = existingPiSession
      ? ["--session", existingPiSession, "--name", piSessionName]
      : ["--session-id", sessionFolder, "--name", piSessionName];
    // Release stdin before handing the terminal to Pi. Keeping readline active
    // here can consume keystrokes intended for Pi's TUI editor.
    rl.close();
    stdin.pause();

    const child = spawn(piBin, piArgs, {
      cwd: initiativePath,
      stdio: "inherit",
    });

    await new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (code, signal) => {
        if (signal) return resolve();
        if (code === 0) return resolve();
        reject(new Error(`Pi exited with code ${code}`));
      });
    });
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(`forge: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

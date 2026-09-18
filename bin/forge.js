#!/usr/bin/env node

const { spawn } = require("node:child_process");
const { createInterface } = require("node:readline/promises");
const { homedir } = require("node:os");
const { stdin, stdout } = require("node:process");
const { join, resolve } = require("node:path");
const { existsSync, readFileSync, readdirSync, statSync } = require("node:fs");
const {
  INITIATIVES_DIR,
  applyLegacyMigration,
  createWorkflowRecord,
  createWorkSession,
  deleteInitiative,
  ensureInitiativesDir,
  formatInitiativeLabel,
  formatInitiativeSummary,
  formatMigrationPlan,
  getRecentSessions,
  listInitiatives,
  planLegacyMigration,
  suggestInitiativeName,
  toKebabCase,
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

async function createInitiativeFlow(rl) {
  const about = (await rl.question("What is this initiative about? ")).trim();
  if (!about) throw new Error("An initiative description is required");

  const goal = (await rl.question("What is the intended goal? ")).trim();
  if (!goal) throw new Error("An intended goal is required");

  const suggestedName = suggestInitiativeName(about, goal);
  const requestedName = (await rl.question(`Initiative name [${suggestedName}]: `)).trim();
  const initName = toKebabCase(requestedName || suggestedName);
  if (!initName) throw new Error("An initiative name is required");

  const initPath = join(INITIATIVES_DIR, initName);
  if (existsSync(initPath)) throw new Error(`Initiative '${initName}' already exists`);

  const { metadata } = createWorkflowRecord(initPath, {
    name: initName,
    displayName: about,
    description: about,
    goal,
    context: about,
    phase: "planning",
  });
  stdout.write(`✓ Initiative created: ${metadata.displayName}\n`);
  return metadata;
}

function nextSessionName(initiativePath) {
  const existing = new Set(getRecentSessions(initiativePath));
  let suffix = "work";
  let counter = 2;
  const date = new Date().toISOString().split("T")[0];
  while (existing.has(`${date}_${suffix}`)) {
    suffix = `work-${counter}`;
    counter += 1;
  }
  return suffix;
}

async function launchPi(cwd, piArgs, rl) {
  // Release stdin before handing the terminal to Pi. Keeping readline active
  // here can consume keystrokes intended for Pi's TUI editor.
  rl.close();
  stdin.pause();

  const piBin = process.env.FORGE_PI_BIN || "pi";
  const child = spawn(piBin, piArgs, {
    cwd,
    stdio: "inherit",
  });

  await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal || code === 0) return resolve();
      reject(new Error(`Pi exited with code ${code}`));
    });
  });
}

async function launchNamedInitiative(initiativeName, sessionName, rl) {
  const initiative = listInitiatives().find((item) => item.name === initiativeName);
  if (!initiative) throw new Error(`Initiative '${initiativeName}' was not found`);

  const initiativePath = join(INITIATIVES_DIR, initiative.name);
  const existingSessions = getRecentSessions(initiativePath);
  let sessionFolder = sessionName;
  if (sessionFolder && !existingSessions.includes(sessionFolder)) {
    throw new Error(`Session '${sessionFolder}' was not found in '${initiativeName}'`);
  }

  if (!sessionFolder) {
    sessionFolder = createWorkSession(
      initiativePath,
      initiative,
      nextSessionName(initiativePath)
    ).sessionFolder;
  }

  const piSessionName = `${initiative.name} — ${sessionFolder}`;
  const existingPiSession = findNamedPiSession(initiativePath, piSessionName);
  const piArgs = existingPiSession
    ? ["--session", existingPiSession, "--name", piSessionName]
    : ["--session-id", sessionFolder, "--name", piSessionName];

  stdout.write(`🏷️ Pi session: ${piSessionName}\n`);
  stdout.write(`🚀 Starting Pi in ${initiativePath}\n\n`);
  await launchPi(initiativePath, piArgs, rl);
}

async function confirmAndDelete(initiative, rl) {
  const initiativePath = join(INITIATIVES_DIR, initiative.name);
  const sessions = getRecentSessions(initiativePath);
  stdout.write(`\n🗑️ About to permanently delete '${initiative.name}'\n`);
  stdout.write(`   Path: ${initiativePath}\n`);
  stdout.write(`   Sessions that will be removed: ${sessions.length}\n`);
  stdout.write("   This cannot be undone.\n");

  const answer = (await rl.question("Delete this initiative? [y/N]: ")).trim().toLowerCase();
  if (answer !== "y" && answer !== "yes") {
    stdout.write("Deletion cancelled.\n");
    return false;
  }

  const result = deleteInitiative(initiative.name);
  stdout.write(`✓ Deleted '${result.name}' (${result.deletedSessions} session(s))\n`);
  return true;
}

async function main() {
  ensureInitiativesDir();
  const args = process.argv.slice(2);
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    if (args[0] === "launch") {
      if (!args[1] || args.length > 3) {
        throw new Error("Usage: forge launch <initiative-name> [session-folder]");
      }
      await launchNamedInitiative(args[1], args[2], rl);
      return;
    }
    if (args[0] === "migrate") {
      const initiativeName = args[1];
      const options = new Set(args.slice(2));
      if (!initiativeName || [...options].some((option) => option !== "--dry-run")) {
        throw new Error("Usage: forge migrate <initiative-name> [--dry-run]");
      }
      const initiative = listInitiatives().find((item) => item.name === initiativeName);
      if (!initiative) throw new Error(`Initiative '${initiativeName}' was not found`);
      const initiativePath = join(INITIATIVES_DIR, initiativeName);
      const plan = planLegacyMigration(initiativePath);
      stdout.write(`${formatMigrationPlan(plan)}\n`);
      if (options.has("--dry-run") || plan.alreadyCurrent || !plan.canMigrate) return;

      const confirmation = (await rl.question("Apply this non-destructive migration? [y/N]: "))
        .trim()
        .toLowerCase();
      if (confirmation !== "y" && confirmation !== "yes") {
        stdout.write("Migration cancelled.\n");
        return;
      }
      const result = applyLegacyMigration(initiativePath);
      stdout.write(`✓ Migration complete. Metadata backup: ${result.backupPath}\n`);
      return;
    }
    if (args[0] === "delete") {
      if (!args[1] || args.length > 2) {
        throw new Error("Usage: forge delete <initiative-name>");
      }
      const initiative = listInitiatives().find((item) => item.name === args[1]);
      if (!initiative) throw new Error(`Initiative '${args[1]}' was not found`);
      await confirmAndDelete(initiative, rl);
      return;
    }
    if (args.length > 0) {
      throw new Error("Usage: forge [launch <initiative-name> [session-folder] | delete <initiative-name> | migrate <initiative-name> [--dry-run]]");
    }

    const initiatives = listInitiatives().sort(
      (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    );

    stdout.write("\n🔨 Forge · Choose a workflow\n");
    stdout.write("1. ⚡ Start a quick task in the current directory\n");
    stdout.write("2. ➕ Create persistent initiative\n");
    stdout.write("3. 🗑️ Delete an initiative\n");
    initiatives.forEach((initiative, index) => {
      stdout.write(`${index + 4}. ${formatInitiativeLabel(initiative)}\n`);
    });

    const selected = await rl.question("\nChoose a workflow: ");
    const selection = Number.parseInt(selected, 10);

    if (selection === 1) {
      stdout.write("🚀 Starting a quick task in the current directory. No Forge record will be created.\n\n");
      await launchPi(process.cwd(), [], rl);
      return;
    }

    if (selection === 3) {
      if (initiatives.length === 0) throw new Error("There are no initiatives to delete");
      initiatives.forEach((item, index) => {
        stdout.write(`${index + 1}. ${formatInitiativeLabel(item)}\n`);
      });
      const chosen = await rl.question("Select an initiative to delete: ");
      const deleteIndex = Number.parseInt(chosen, 10) - 1;
      if (!Number.isInteger(deleteIndex) || !initiatives[deleteIndex]) {
        throw new Error("Choose a listed initiative number");
      }
      await confirmAndDelete(initiatives[deleteIndex], rl);
      return;
    }

    let initiative;
    if (selection === 2) {
      initiative = await createInitiativeFlow(rl);
    } else {
      const index = selection - 4;
      if (!Number.isInteger(index) || !initiatives[index]) {
        throw new Error("Choose a listed workflow number");
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
    const existingPiSession = findNamedPiSession(initiativePath, piSessionName);
    const piArgs = existingPiSession
      ? ["--session", existingPiSession, "--name", piSessionName]
      : ["--session-id", sessionFolder, "--name", piSessionName];
    stdout.write(`🏷️ Pi session: ${piSessionName}\n`);
    stdout.write(`🚀 Starting Pi in ${initiativePath}\n\n`);
    await launchPi(initiativePath, piArgs, rl);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(`forge: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

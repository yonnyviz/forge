#!/usr/bin/env node

const { spawn } = require("node:child_process");
const { createInterface } = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const { join } = require("node:path");
const {
  INITIATIVES_DIR,
  createWorkSession,
  ensureInitiativesDir,
  listInitiatives,
} = require("../src/initiative-store.js");

async function main() {
  ensureInitiativesDir();
  const initiatives = listInitiatives().sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  );

  if (initiatives.length === 0) {
    throw new Error(`No initiatives found in ${INITIATIVES_DIR}`);
  }

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    stdout.write("\n🔨 Forge initiatives\n");
    initiatives.forEach((initiative, index) => {
      stdout.write(`${index + 1}. ${initiative.displayName} (${initiative.status})\n`);
    });

    const selected = await rl.question("\nChoose an initiative: ");
    const index = Number.parseInt(selected, 10) - 1;
    if (!Number.isInteger(index) || !initiatives[index]) {
      throw new Error("Choose a listed initiative number");
    }

    const sessionName = await rl.question("Session name [work]: ");
    const name = sessionName.trim() || "work";
    const initiative = initiatives[index];
    const initiativePath = join(INITIATIVES_DIR, initiative.name);
    const { sessionFolder } = createWorkSession(initiativePath, initiative, name);

    stdout.write(`\n✓ Created Forge session: ${sessionFolder}\n`);
    stdout.write(`🚀 Starting Pi in ${initiativePath}\n\n`);

    const piBin = process.env.FORGE_PI_BIN || "pi";
    const child = spawn(piBin, ["--name", name], {
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

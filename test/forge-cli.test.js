const assert = require("node:assert/strict");
const { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const test = require("node:test");
const { createWorkflowRecord } = require("../src/initiative-store.js");

const repoRoot = resolve(__dirname, "..");
const cliPath = join(repoRoot, "bin", "forge.js");

function setup() {
  const root = mkdtempSync(join(tmpdir(), "forge-cli-"));
  const logPath = join(root, "pi.log");
  const fakePi = join(root, "fake-pi.sh");
  writeFileSync(fakePi, "#!/bin/sh\nprintf '%s\\n' \"$PWD\" > \"$FORGE_TEST_LOG\"\nprintf '%s\\n' \"$*\" >> \"$FORGE_TEST_LOG\"\n");
  chmodSync(fakePi, 0o755);
  return { root, logPath, fakePi };
}

function forgeEnvironment(setupState) {
  return {
    ...process.env,
    FORGE_INITIATIVES_DIR: setupState.root,
    FORGE_PI_BIN: setupState.fakePi,
    FORGE_TEST_LOG: setupState.logPath,
  };
}

function runForge(args, input, setupState) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    input,
    encoding: "utf8",
    env: forgeEnvironment(setupState),
  });
}

function runForgeInteractive(args, lines, setupState) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env: forgeEnvironment(setupState),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));

    let index = 0;
    const sendNext = () => {
      if (index === lines.length) {
        child.stdin.end();
        return;
      }
      child.stdin.write(`${lines[index]}\n`);
      index += 1;
      setTimeout(sendNext, 100);
    };
    sendNext();
  });
}

test("quick CLI work launches Pi without creating a Forge initiative", () => {
  const state = setup();
  try {
    const result = runForge([], "1\n", state);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /quick task/i);
    assert.equal(readFileSync(state.logPath, "utf8").split("\n")[0], repoRoot);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test("persistent CLI creation uses the minimal workflow record", async () => {
  const state = setup();
  try {
    const result = await runForgeInteractive(
      [],
      ["2", "Ship the workflow", "Keep it dependency-free", "", ""],
      state
    );
    assert.equal(result.status, 0, result.stderr);

    const initiativePath = join(state.root, "ship-the-workflow");
    assert.match(readFileSync(join(initiativePath, "brief.md"), "utf8"), /forge-context/);
    assert.match(readFileSync(join(initiativePath, "memory.md"), "utf8"), /forge-context/);
    assert.equal(require("node:fs").existsSync(join(initiativePath, "planning")), false);
    assert.match(readFileSync(state.logPath, "utf8"), new RegExp(initiativePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test("launch command opens a named initiative in its own root", () => {
  const state = setup();
  try {
    const initiativePath = join(state.root, "named-initiative");
    createWorkflowRecord(initiativePath, { name: "named-initiative", outcome: "Reopen it" });
    const result = runForge(["launch", "named-initiative"], "", state);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(realpathSync(readFileSync(state.logPath, "utf8").split("\n")[0]), realpathSync(initiativePath));
    assert.match(result.stdout, /Starting Pi in/);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

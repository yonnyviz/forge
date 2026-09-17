const { execFileSync, spawn } = require("node:child_process");
const { existsSync, mkdirSync, openSync, closeSync, unlinkSync, readFileSync, writeFileSync } = require("node:fs");
const { homedir } = require("node:os");
const { dirname, join, resolve } = require("node:path");
const { configPath, ensureDashboardConfig, readDashboardConfig, runtimePath } = require("./dashboard-store.js");

const LAUNCH_IDENTITY = "forge-dashboard-v1";
const SERVER_PATH = resolve(__dirname, "dashboard-server.js");
const DEFAULT_PORT = 4317;
const START_TIMEOUT_MS = 8000;
const STOP_TIMEOUT_MS = 3000;

function readRuntimeRecord() {
  const path = runtimePath();
  if (!existsSync(path)) return null;
  try {
    const record = JSON.parse(readFileSync(path, "utf8"));
    if (!record || typeof record !== "object") return null;
    return record;
  } catch {
    return null;
  }
}

function removeRuntimeRecord() {
  try {
    unlinkSync(runtimePath());
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function writeRuntimeRecord(record) {
  const path = runtimePath();
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  require("node:fs").renameSync(temporary, path);
}

function processCommand(pid) {
  try {
    return execFileSync("ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function hasForgeIdentity(record) {
  if (!record || record.launchIdentity !== LAUNCH_IDENTITY || !processIsAlive(record.pid)) return false;
  const command = processCommand(record.pid);
  return command.includes(SERVER_PATH) && command.includes(`--identity ${LAUNCH_IDENTITY}`);
}

function requestHealth(port) {
  return new Promise((resolveHealth) => {
    const http = require("node:http");
    const request = http.get({ hostname: "127.0.0.1", port, path: "/_forge/health", timeout: 500 }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => (body += chunk));
      response.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolveHealth(response.statusCode === 200 && parsed.launchIdentity === LAUNCH_IDENTITY);
        } catch {
          resolveHealth(false);
        }
      });
    });
    request.on("error", () => resolveHealth(false));
    request.on("timeout", () => request.destroy());
  });
}

async function inspectDashboard() {
  const record = readRuntimeRecord();
  if (!record) return { state: "stopped", record: null, url: null };
  if (!hasForgeIdentity(record) || !(await requestHealth(record.port))) {
    return { state: "stale-record", record, url: null };
  }
  return { state: "running", record, url: `http://127.0.0.1:${record.port}` };
}

function waitForServer(child, port, errorOutput) {
  return new Promise((resolveReady, rejectReady) => {
    let output = "";
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };
    const timeout = setTimeout(() => finish(rejectReady, new Error("Dashboard server did not become ready in time")), START_TIMEOUT_MS);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      const match = output.match(/FORGE_DASHBOARD_READY\s+(\d+)/);
      if (match) finish(resolveReady, Number(match[1]));
    });
    child.stderr.on("data", (chunk) => (errorOutput.value += chunk.toString()));
    child.once("error", (error) => finish(rejectReady, error));
    child.once("exit", (code, signal) => {
      if (!settled) finish(rejectReady, new Error(`Dashboard server exited${signal ? ` with ${signal}` : ` with code ${code}`}`));
    });
  });
}

async function spawnDashboard(port) {
  const errorOutput = { value: "" };
  const child = spawn(process.execPath, [SERVER_PATH, "--port", String(port), "--config", configPath(), "--identity", LAUNCH_IDENTITY], {
    cwd: dirname(SERVER_PATH),
    env: { ...process.env },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const actualPort = await waitForServer(child, port, errorOutput);
    // The detached server must not keep the invoking CLI alive through piped stdio.
    child.stdout.destroy();
    child.stderr.destroy();
    child.unref();
    return { pid: child.pid, port: actualPort };
  } catch (error) {
    try { child.kill("SIGTERM"); } catch { /* already exited */ }
    const suffix = errorOutput.value.trim() ? `: ${errorOutput.value.trim()}` : "";
    throw new Error(`${error.message}${suffix}`);
  }
}

async function withStartLock(operation) {
  const lockPath = `${runtimePath()}.lock`;
  mkdirSync(dirname(lockPath), { recursive: true });
  let acquired = false;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const descriptor = openSync(lockPath, "wx", 0o600);
      closeSync(descriptor);
      acquired = true;
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  if (!acquired) throw new Error("Another Forge dashboard start is still in progress");
  try {
    return await operation();
  } finally {
    try { unlinkSync(lockPath); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}

async function startDashboard() {
  ensureDashboardConfig();
  // The lock makes simultaneous starts from Pi and the CLI idempotent too.
  return withStartLock(async () => {
    // Reading the config here validates it before a process is started.
    readDashboardConfig();
    const current = await inspectDashboard();
    if (current.state === "running") return { ...current, reused: true };
    if (current.state === "stale-record") removeRuntimeRecord();

    const requestedPort = Number.parseInt(process.env.FORGE_DASHBOARD_PORT || String(DEFAULT_PORT), 10);
    let server;
    try {
      server = await spawnDashboard(Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 0);
    } catch (error) {
      // A preferred port may belong to an unrelated process. Let the OS choose a safe port.
      if (requestedPort !== 0) server = await spawnDashboard(0);
      else throw error;
    }
    const record = {
      pid: server.pid,
      port: server.port,
      startedAt: new Date().toISOString(),
      launchIdentity: LAUNCH_IDENTITY,
    };
    writeRuntimeRecord(record);
    return { state: "running", record, url: `http://127.0.0.1:${server.port}`, reused: false };
  });
}

function waitForExit(pid, timeoutMs) {
  return new Promise((resolveExit) => {
    const started = Date.now();
    const poll = () => {
      if (!processIsAlive(pid)) return resolveExit(true);
      if (Date.now() - started >= timeoutMs) return resolveExit(false);
      setTimeout(poll, 50);
    };
    poll();
  });
}

async function stopDashboard() {
  const current = await inspectDashboard();
  if (current.state === "stopped") return { state: "already-stopped", record: null };
  if (current.state === "stale-record") {
    removeRuntimeRecord();
    return { state: "stale-record", record: current.record };
  }

  try {
    process.kill(current.record.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") return { state: "failed", record: current.record, error: error.message };
  }
  const exited = await waitForExit(current.record.pid, STOP_TIMEOUT_MS);
  if (!exited) {
    try { process.kill(current.record.pid, "SIGKILL"); } catch { /* process exited between polls */ }
    const killed = await waitForExit(current.record.pid, 500);
    if (!killed) return { state: "failed", record: current.record, error: "Dashboard did not stop before the timeout" };
  }
  removeRuntimeRecord();
  return { state: "stopped", record: current.record };
}

async function statusDashboard() {
  const current = await inspectDashboard();
  if (current.state === "stale-record") removeRuntimeRecord();
  return current;
}

function openUrl(url) {
  const platform = process.platform;
  const command = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.on("error", () => {});
  child.unref();
}

async function openDashboard() {
  const current = await startDashboard();
  openUrl(current.url);
  return current;
}

module.exports = {
  DEFAULT_PORT,
  LAUNCH_IDENTITY,
  openDashboard,
  startDashboard,
  statusDashboard,
  stopDashboard,
};

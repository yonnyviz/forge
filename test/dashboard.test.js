const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const fixtures = join(__dirname, "fixtures", "initiatives");
const store = require("../src/dashboard-store.js");
const lifecycle = require("../src/dashboard-lifecycle.js");

function useTempConfig() {
  const home = mkdtempSync(join(tmpdir(), "forge-dashboard-"));
  const config = join(home, "config.json");
  const runtime = join(home, "runtime.json");
  writeFileSync(config, JSON.stringify({ initiativeRoots: [fixtures] }));
  const previous = {
    config: process.env.FORGE_DASHBOARD_CONFIG,
    runtime: process.env.FORGE_DASHBOARD_RUNTIME,
    port: process.env.FORGE_DASHBOARD_PORT,
  };
  process.env.FORGE_DASHBOARD_CONFIG = config;
  process.env.FORGE_DASHBOARD_RUNTIME = runtime;
  process.env.FORGE_DASHBOARD_PORT = "0";
  return { home, restore() {
    for (const [key, value] of Object.entries({
      FORGE_DASHBOARD_CONFIG: previous.config,
      FORGE_DASHBOARD_RUNTIME: previous.runtime,
      FORGE_DASHBOARD_PORT: previous.port,
    })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    rmSync(home, { recursive: true, force: true });
  } };
}

test("discovers rich, sparse, and malformed initiatives with normalized summaries", () => {
  const context = useTempConfig();
  try {
    const initiatives = store.discoverInitiatives(store.readDashboardConfig());
    assert.deepEqual(initiatives.map((item) => item.name), ["malformed", "rich", "sparse"]);
    const summaries = initiatives.map(store.normalizeInitiative);
    const rich = summaries.find((item) => item.name === "rich");
    const sparse = summaries.find((item) => item.name === "sparse");
    const malformed = summaries.find((item) => item.name === "malformed");
    assert.equal(rich.title, "Rich Fixture");
    assert.equal(rich.progress, 70);
    assert.equal(rich.next_action, "Validate safe reads");
    assert.deepEqual(rich.recent_progress, ["Added the overview contract", "Verified the local boundary"]);
    const detail = store.getInitiativeDetail(initiatives.find((item) => item.name === "rich"));
    assert.deepEqual(detail.milestones.map((item) => item.id), ["M1", "M2", "M3"]);
    assert.equal(detail.decisions[0].status, "Accepted");
    assert.ok(detail.files.includes("planning/ROADMAP.md"));
    assert.ok(!detail.files.some((file) => file.startsWith(".")));
    assert.equal(sparse.title, "Sparse Fixture");
    assert.equal(malformed.title, "Malformed Fixture");
    assert.equal(malformed.status, "unknown");
  } finally { context.restore(); }
});

test("rejects traversal and non-document reads", () => {
  const context = useTempConfig();
  try {
    assert.throws(() => store.safeFilePath(fixtures, "../outside.md"), /restricted|escapes/);
    assert.throws(() => store.safeFilePath(fixtures, ".forge/metadata.json/../README.md"), /File not found|restricted/);
    assert.throws(() => store.safeFilePath(fixtures, "README.txt"), /restricted/);
  } finally { context.restore(); }
});

test("starts, reuses, serves, and stops one dashboard", async () => {
  const context = useTempConfig();
  try {
    const first = await lifecycle.startDashboard();
    const second = await lifecycle.startDashboard();
    assert.equal(first.state, "running");
    assert.equal(second.reused, true);
    assert.equal(second.url, first.url);
    const response = await fetch(`${first.url}/api/initiatives`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).length, 3);
    const page = await fetch(`${first.url}/`);
    assert.equal(page.status, 200);
    const pageText = await page.text();
    assert.match(pageText, /Initiative detail/);
    assert.match(pageText, /prefers-reduced-motion/);
    assert.match(pageText, /setInterval\(\(\)=>/);
    const detail = await fetch(`${first.url}/api/initiatives/0%3Arich`);
    assert.equal(detail.status, 200);
    assert.equal((await detail.json()).milestones.length, 3);
    const roadmap = await fetch(`${first.url}/api/initiatives/0%3Arich/files?path=planning%2FROADMAP.md`);
    assert.equal(roadmap.status, 200);
    assert.match((await roadmap.json()).content, /Milestone Overview/);
    const hidden = await fetch(`${first.url}/api/initiatives/0%3Arich/files?path=.forge%2Fmetadata.json`);
    assert.equal(hidden.status, 403);
    const stopped = await lifecycle.stopDashboard();
    assert.equal(stopped.state, "stopped");
    assert.equal((await lifecycle.statusDashboard()).state, "stopped");
  } finally { context.restore(); }
});

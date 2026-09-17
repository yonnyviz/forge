const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, readdirSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");
const {
  createForgeContextDocument,
  createWorkflowRecord,
  parseForgeContextDocument,
  readWorkflowRecord,
  updateWorkflowBrief,
  updateWorkflowMemory,
  validateWorkflowMetadata,
} = require("../src/initiative-store.js");

function temporaryInitiative() {
  return mkdtempSync(join(tmpdir(), "forge-workflow-"));
}

test("creates a minimal workflow record with an agent index", () => {
  const initPath = temporaryInitiative();
  try {
    const result = createWorkflowRecord(initPath, {
      name: "compact-workflow",
      outcome: "Ship compact workflow records",
      definitionOfDone: ["The records are readable by agents"],
      scope: { in: ["record storage"], out: ["dashboard"] },
      constraints: ["Keep the package dependency-free"],
      affectedPaths: ["src/initiative-store.js"],
      nextAction: "Add integration tests",
    });

    assert.equal(result.metadata.schemaVersion, 2);
    assert.deepEqual(result.metadata.documents, {
      brief: "brief.md",
      memory: "memory.md",
      outputs: "outputs/",
    });
    assert.deepEqual(result.metadata.agent.readOrder, ["brief.md", "memory.md"]);
    assert.equal(result.metadata.agent.nextAction, "Add integration tests");
    assert.deepEqual(result.metadata.agent.affectedPaths, ["src/initiative-store.js"]);
    assert.deepEqual(readdirSync(initPath).sort(), [".forge", "brief.md", "memory.md", "outputs"]);
    assert.equal(parseForgeContextDocument(readFileSync(join(initPath, "brief.md"), "utf8"), "forge/brief").context.outcome, "Ship compact workflow records");
  } finally {
    rmSync(initPath, { recursive: true, force: true });
  }
});

test("reads and updates memory while refreshing the metadata cache", () => {
  const initPath = temporaryInitiative();
  try {
    createWorkflowRecord(initPath, {
      name: "memory-update",
      outcome: "Keep durable context",
      nextAction: "Write the first record",
    });

    const before = readWorkflowRecord(initPath);
    const updated = updateWorkflowMemory(initPath, {
      nextAction: "Review the implementation",
      openQuestions: ["Is the format compact enough?"],
      body: "# Memory\n\nDurable context belongs here.",
    });
    const after = readWorkflowRecord(initPath);

    assert.notEqual(after.memory.context.updated, before.memory.context.updated);
    assert.equal(after.memory.context.nextAction, "Review the implementation");
    assert.deepEqual(after.memory.context.openQuestions, ["Is the format compact enough?"]);
    assert.equal(after.memory.body, "# Memory\n\nDurable context belongs here.");
    assert.equal(after.metadata.agent.nextAction, "Review the implementation");
    assert.equal(updated.metadata.lastUpdated, after.metadata.lastUpdated);
    assert.equal(readdirSync(join(initPath, ".forge")).some((name) => name.includes(".tmp-")), false);
  } finally {
    rmSync(initPath, { recursive: true, force: true });
  }
});

test("updates the brief and its affected-path index", () => {
  const initPath = temporaryInitiative();
  try {
    createWorkflowRecord(initPath, {
      name: "brief-update",
      outcome: "Track the affected files",
      affectedPaths: ["README.md"],
    });

    updateWorkflowBrief(initPath, {
      outcome: "Track the exact affected files",
      affectedPaths: ["src/forge.ts", "bin/forge.js"],
      definitionOfDone: ["Both entry points use the shared API"],
    });
    const record = readWorkflowRecord(initPath);

    assert.equal(record.brief.context.outcome, "Track the exact affected files");
    assert.deepEqual(record.metadata.agent.affectedPaths, ["src/forge.ts", "bin/forge.js"]);
    assert.deepEqual(record.brief.context.definitionOfDone, ["Both entry points use the shared API"]);
  } finally {
    rmSync(initPath, { recursive: true, force: true });
  }
});

test("rejects invalid metadata document locations", () => {
  const initPath = temporaryInitiative();
  try {
    const { metadata } = createWorkflowRecord(initPath, { name: "safe-paths", outcome: "Validate paths" });
    assert.throws(() => validateWorkflowMetadata({
      ...metadata,
      documents: { ...metadata.documents, memory: "../memory.md" },
    }), /memory path must be memory\.md/);
  } finally {
    rmSync(initPath, { recursive: true, force: true });
  }
});

test("requires the bounded JSON context block", () => {
  assert.throws(() => parseForgeContextDocument("# Memory", "forge/memory"), /Missing forge-context JSON block/);
  const content = createForgeContextDocument({ type: "forge/memory", version: 1, nextAction: "Continue" }, "# Memory");
  assert.equal(parseForgeContextDocument(content, "forge/memory").context.nextAction, "Continue");
});

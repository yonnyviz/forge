const assert = require("node:assert/strict");
const { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");
const {
  applyLegacyMigration,
  createForgeContextDocument,
  createWorkflowRecord,
  parseForgeContextDocument,
  planLegacyMigration,
  readWorkflowRecord,
  updateWorkflowBrief,
  updateWorkflowMemory,
  validateWorkflowMetadata,
} = require("../src/initiative-store.js");

function temporaryInitiative() {
  return mkdtempSync(join(tmpdir(), "forge-workflow-"));
}

function createLegacyInitiative(initPath, overrides = {}) {
  mkdirSync(join(initPath, ".forge"), { recursive: true });
  mkdirSync(join(initPath, "docs"), { recursive: true });
  mkdirSync(join(initPath, "sessions", "2026-09-17_delivery"), { recursive: true });
  const metadata = {
    name: "legacy-work",
    displayName: "Legacy Work",
    description: "Existing context",
    goal: "Deliver the legacy work",
    status: "active",
    phase: "execution",
    created: "2026-09-01T00:00:00.000Z",
    lastSession: "2026-09-17T00:00:00.000Z",
    lastUpdated: "2026-09-17T00:00:00.000Z",
    owner: "owner",
    tags: ["legacy"],
    sessionCount: 1,
    relatedInitiatives: [],
    ...overrides,
  };
  writeFileSync(join(initPath, ".forge", "metadata.json"), JSON.stringify(metadata, null, 2));
  writeFileSync(join(initPath, "README.md"), "# Legacy Work\n\n## Goal\nDeliver the legacy work\n\n## Definition of Done\n- Release is accepted\n");
  writeFileSync(join(initPath, "docs", "DECISIONS.md"), "# Decisions\n\nLegacy history stays here.\n");
  writeFileSync(join(initPath, "sessions", "2026-09-17_delivery", "notes.md"), "# Session\n\n## What Was Done\n- Implemented migration input\n\n## Next Session\n- Review migrated context\n\n## Blockers/Questions\n- Confirm scope\n");
  return metadata;
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

test("previews legacy migration without changing files", () => {
  const initPath = temporaryInitiative();
  try {
    const legacyMetadata = createLegacyInitiative(initPath);
    const plan = planLegacyMigration(initPath);

    assert.equal(plan.canMigrate, true);
    assert.equal(plan.alreadyCurrent, false);
    assert.match(plan.preview.brief.context.outcome, /Deliver the legacy work/);
    assert.deepEqual(plan.preview.brief.context.definitionOfDone, ["Release is accepted"]);
    assert.deepEqual(plan.preview.memory.context.progress, ["Implemented migration input"]);
    assert.equal(plan.preview.memory.context.nextAction, "Review migrated context");
    assert.equal(existsSync(join(initPath, "brief.md")), false);
    assert.deepEqual(JSON.parse(readFileSync(join(initPath, ".forge", "metadata.json"), "utf8")), legacyMetadata);
  } finally {
    rmSync(initPath, { recursive: true, force: true });
  }
});

test("migrates legacy records with a metadata backup and preserves history", () => {
  const initPath = temporaryInitiative();
  try {
    const legacyMetadata = createLegacyInitiative(initPath);
    const legacyReadme = readFileSync(join(initPath, "README.md"), "utf8");
    const result = applyLegacyMigration(initPath);
    const record = readWorkflowRecord(initPath);

    assert.equal(record.metadata.schemaVersion, 2);
    assert.equal(record.metadata.name, legacyMetadata.name);
    assert.equal(record.metadata.sessionCount, 1);
    assert.equal(record.memory.context.nextAction, "Review migrated context");
    assert.equal(readFileSync(join(initPath, "README.md"), "utf8"), legacyReadme);
    assert.equal(readFileSync(result.backupPath, "utf8"), JSON.stringify(legacyMetadata, null, 2));
    assert.equal(existsSync(join(initPath, "docs", "DECISIONS.md")), true);
    assert.equal(planLegacyMigration(initPath).alreadyCurrent, true);
  } finally {
    rmSync(initPath, { recursive: true, force: true });
  }
});

test("blocks migration when an existing workflow document is malformed", () => {
  const initPath = temporaryInitiative();
  try {
    createLegacyInitiative(initPath);
    writeFileSync(join(initPath, "brief.md"), "# Custom brief that must not be overwritten\n");
    const plan = planLegacyMigration(initPath);

    assert.equal(plan.canMigrate, false);
    assert.match(plan.conflicts.join(" "), /brief\.md exists/);
    assert.throws(() => applyLegacyMigration(initPath), /Migration blocked/);
    assert.equal(readFileSync(join(initPath, "brief.md"), "utf8"), "# Custom brief that must not be overwritten\n");
  } finally {
    rmSync(initPath, { recursive: true, force: true });
  }
});

test("preserves a valid partial workflow document during migration", () => {
  const initPath = temporaryInitiative();
  try {
    createLegacyInitiative(initPath);
    const brief = createForgeContextDocument({
      type: "forge/brief",
      version: 1,
      outcome: "Curated outcome",
      definitionOfDone: [],
      context: "",
      scope: { in: [], out: [] },
      constraints: [],
      affectedPaths: ["src/custom.js"],
    }, "# Brief\n\nKeep this body.");
    writeFileSync(join(initPath, "brief.md"), brief);

    const plan = planLegacyMigration(initPath);
    assert.equal(plan.canMigrate, true);
    assert.equal(plan.preview.existingBrief, true);
    applyLegacyMigration(initPath);

    assert.equal(readFileSync(join(initPath, "brief.md"), "utf8"), brief);
    assert.deepEqual(readWorkflowRecord(initPath).metadata.agent.affectedPaths, ["src/custom.js"]);
  } finally {
    rmSync(initPath, { recursive: true, force: true });
  }
});

test("rejects migration when legacy metadata is missing or malformed", () => {
  const missingPath = temporaryInitiative();
  const malformedPath = temporaryInitiative();
  try {
    assert.throws(() => planLegacyMigration(missingPath), /metadata was not found/);
    mkdirSync(join(malformedPath, ".forge"), { recursive: true });
    writeFileSync(join(malformedPath, ".forge", "metadata.json"), "{not-json");
    assert.throws(() => planLegacyMigration(malformedPath), SyntaxError);
  } finally {
    rmSync(missingPath, { recursive: true, force: true });
    rmSync(malformedPath, { recursive: true, force: true });
  }
});

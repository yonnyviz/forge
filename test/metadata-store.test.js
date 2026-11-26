/**
 * Unit tests for metadata-store
 */

import { test } from "node:test";
import assert from "node:assert";
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createMetadata,
  loadMetadata,
  saveMetadata,
  validateMetadata,
  isValidKebabCase,
  toKebabCase,
  suggestInitiativeName,
} from "../src/metadata-store.js";

const TEST_DIR = join(process.cwd(), ".test-metadata");

function setup() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
}

function teardown() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

test("createMetadata - creates valid metadata object", () => {
  const metadata = createMetadata("test-initiative", "Test Initiative", "Build something great");

  assert.strictEqual(metadata.name, "test-initiative");
  assert.strictEqual(metadata.displayName, "Test Initiative");
  assert.strictEqual(metadata.outcome, "Build something great");
  assert.strictEqual(metadata.stage, "planning");
  assert.strictEqual(metadata.nextAction, "Define the outcome and definition of done");
  assert.ok(Array.isArray(metadata.constraints));
  assert.ok(Array.isArray(metadata.definitionOfDone));
  assert.ok(Array.isArray(metadata.progress));
  assert.strictEqual(metadata.progress.length, 1);
  assert.strictEqual(metadata.progress[0].entry, "Initiative created");
  assert.ok(metadata.created);
  assert.ok(metadata.updated);
});

test("createMetadata - uses displayName as outcome if not provided", () => {
  const metadata = createMetadata("test-init", "Test Init");
  assert.strictEqual(metadata.outcome, "Test Init");
});

test("createMetadata - rejects invalid name", () => {
  assert.throws(
    () => createMetadata("Invalid Name", "Test"),
    /Invalid initiative name/
  );
});

test("isValidKebabCase - validates kebab-case names", () => {
  assert.strictEqual(isValidKebabCase("valid-name"), true);
  assert.strictEqual(isValidKebabCase("valid-name-123"), true);
  assert.strictEqual(isValidKebabCase("123-valid"), true);
  assert.strictEqual(isValidKebabCase("a"), true);
  
  assert.strictEqual(isValidKebabCase("Invalid-Name"), false);
  assert.strictEqual(isValidKebabCase("invalid_name"), false);
  assert.strictEqual(isValidKebabCase("invalid name"), false);
  assert.strictEqual(isValidKebabCase("-invalid"), false);
  assert.strictEqual(isValidKebabCase("invalid-"), false);
  assert.strictEqual(isValidKebabCase(""), false);
});

test("toKebabCase - converts to kebab-case", () => {
  assert.strictEqual(toKebabCase("Build Authentication System"), "build-authentication-system");
  assert.strictEqual(toKebabCase("Project Alpha"), "project-alpha");
  assert.strictEqual(toKebabCase("Test_Project"), "testproject"); // underscores removed
  assert.strictEqual(toKebabCase("Test  Multiple   Spaces"), "test-multiple-spaces");
  assert.strictEqual(toKebabCase("Special!@#$%Characters"), "specialcharacters");
});

test("suggestInitiativeName - suggests name from description", () => {
  const name = suggestInitiativeName("Build Authentication System");
  assert.strictEqual(name, "build-authentication-system");
});

test("suggestInitiativeName - combines description and goal", () => {
  const name = suggestInitiativeName("Authentication", "Secure user login");
  assert.ok(name.includes("authentication"));
  assert.ok(name.includes("secure"));
});

test("validateMetadata - accepts valid metadata", () => {
  const metadata = createMetadata("test", "Test");
  const errors = validateMetadata(metadata);
  assert.strictEqual(errors.length, 0);
});

test("validateMetadata - detects missing required fields", () => {
  const invalid = {
    name: "test",
    // missing displayName
    outcome: "test",
    stage: "planning",
    nextAction: "test",
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    constraints: [],
    definitionOfDone: [],
    progress: [],
    decisions: [],
    blockers: [],
    questions: [],
    outputs: [],
    sessions: [],
  };

  const errors = validateMetadata(invalid);
  assert.ok(errors.length > 0);
  assert.ok(errors.some((e) => e.field === "displayName"));
});

test("validateMetadata - detects invalid stage", () => {
  const metadata = createMetadata("test", "Test");
  metadata.stage = "invalid";

  const errors = validateMetadata(metadata);
  assert.ok(errors.length > 0);
  assert.ok(errors.some((e) => e.field === "stage"));
});

test("validateMetadata - detects invalid name format", () => {
  const metadata = createMetadata("test", "Test");
  metadata.name = "Invalid Name";

  const errors = validateMetadata(metadata);
  assert.ok(errors.length > 0);
  assert.ok(errors.some((e) => e.field === "name"));
});

test("validateMetadata - detects missing arrays", () => {
  const invalid = {
    name: "test",
    displayName: "Test",
    outcome: "test",
    stage: "planning",
    nextAction: "test",
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    constraints: [],
    definitionOfDone: [],
    progress: null, // should be array
    decisions: [],
    blockers: [],
    questions: [],
    outputs: [],
    sessions: [],
  };

  const errors = validateMetadata(invalid);
  assert.ok(errors.length > 0);
  assert.ok(errors.some((e) => e.field === "progress"));
});

test("validateMetadata - detects invalid DoD items", () => {
  const metadata = createMetadata("test", "Test");
  metadata.definitionOfDone = [
    { criterion: "Valid item", completed: true },
    { criterion: "", completed: true }, // invalid: empty criterion
    { criterion: "Another", completed: "yes" }, // invalid: not boolean
  ];

  const errors = validateMetadata(metadata);
  assert.ok(errors.length > 0);
});

test("validateMetadata - detects invalid progress entries", () => {
  const metadata = createMetadata("test", "Test");
  metadata.progress.push(
    { timestamp: "invalid", entry: "Test" }, // invalid timestamp
    { timestamp: new Date().toISOString(), entry: "" } // empty entry
  );

  const errors = validateMetadata(metadata);
  assert.ok(errors.length > 0);
});

test("saveMetadata and loadMetadata - round-trip", () => {
  setup();

  try {
    const metadata = createMetadata("test-round-trip", "Test Round Trip");
    const path = join(TEST_DIR, "metadata.json");

    // Save
    saveMetadata(path, metadata);
    assert.ok(existsSync(path));

    // Load
    const loaded = loadMetadata(path);
    assert.strictEqual(loaded.name, metadata.name);
    assert.strictEqual(loaded.displayName, metadata.displayName);
    assert.strictEqual(loaded.stage, metadata.stage);
    assert.strictEqual(loaded.progress.length, metadata.progress.length);

    // Updated timestamp should be newer or equal
    assert.ok(new Date(loaded.updated) >= new Date(metadata.updated));
  } finally {
    teardown();
  }
});

test("saveMetadata - creates directory if missing", () => {
  setup();

  try {
    const metadata = createMetadata("test-mkdir", "Test Mkdir");
    const path = join(TEST_DIR, "nested", "deep", "metadata.json");

    saveMetadata(path, metadata);
    assert.ok(existsSync(path));

    const loaded = loadMetadata(path);
    assert.strictEqual(loaded.name, "test-mkdir");
  } finally {
    teardown();
  }
});

test("saveMetadata - rejects invalid metadata", () => {
  setup();

  try {
    const invalid = {
      name: "test",
      // missing required fields
    };

    const path = join(TEST_DIR, "invalid.json");
    assert.throws(
      () => saveMetadata(path, invalid),
      /Cannot save invalid metadata/
    );
  } finally {
    teardown();
  }
});

test("loadMetadata - throws on missing file", () => {
  assert.throws(
    () => loadMetadata("/nonexistent/metadata.json"),
    /Metadata file not found/
  );
});

test("loadMetadata - throws on corrupted JSON", () => {
  setup();

  try {
    const path = join(TEST_DIR, "corrupted.json");
    mkdirSync(join(TEST_DIR), { recursive: true });
    writeFileSync(path, "{ invalid json", "utf8");

    assert.throws(
      () => loadMetadata(path),
      /Corrupted metadata file/
    );
  } finally {
    teardown();
  }
});

test("loadMetadata - throws on invalid metadata structure", () => {
  setup();

  try {
    const path = join(TEST_DIR, "invalid-structure.json");
    const invalid = { name: "test", stage: "invalid-stage" };
    mkdirSync(join(TEST_DIR), { recursive: true });
    writeFileSync(path, JSON.stringify(invalid), "utf8");

    assert.throws(
      () => loadMetadata(path),
      /Invalid metadata/
    );
  } finally {
    teardown();
  }
});

test("metadata - supports all required fields", () => {
  const metadata = createMetadata("full-test", "Full Test");

  // Add various entries
  metadata.scope = "Build and test authentication system";
  metadata.constraints.push("Must use existing Redis instance");
  
  metadata.definitionOfDone.push({
    criterion: "User registration working",
    completed: true,
    completedAt: new Date().toISOString(),
  });

  metadata.progress.push({
    timestamp: new Date().toISOString(),
    entry: "Implemented JWT token generation",
    session: "morning",
  });

  metadata.decisions.push({
    timestamp: new Date().toISOString(),
    decision: "Use bcrypt for password hashing",
    rationale: "Industry standard, good balance",
    alternatives: ["argon2", "scrypt"],
  });

  metadata.blockers.push({
    added: new Date().toISOString(),
    blocker: "Waiting for database credentials",
    active: true,
  });

  metadata.questions.push({
    added: new Date().toISOString(),
    question: "Should tokens expire after 15min or 1h?",
    open: true,
  });

  metadata.outputs.push({
    path: "auth/jwt.ts",
    added: new Date().toISOString(),
    description: "JWT token utilities",
  });

  metadata.sessions.push({
    start: new Date().toISOString(),
    name: "morning",
    progressEntries: 3,
  });

  const errors = validateMetadata(metadata);
  assert.strictEqual(errors.length, 0, `Validation errors: ${JSON.stringify(errors)}`);
});

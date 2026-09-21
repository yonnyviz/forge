/**
 * Metadata Store - CRUD operations for .forge/metadata.json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";

/**
 * Create a new metadata object with default values
 */
export function createMetadata(name, displayName, outcome) {
  if (!isValidKebabCase(name)) {
    throw new Error(`Invalid initiative name: '${name}'. Must be kebab-case.`);
  }

  const now = new Date().toISOString();

  return {
    name,
    displayName,
    outcome: outcome || displayName,
    constraints: [],
    stage: "planning",
    nextAction: "Define the outcome and definition of done",
    created: now,
    updated: now,
    definitionOfDone: [],
    progress: [
      {
        timestamp: now,
        entry: "Initiative created",
      },
    ],
    decisions: [],
    blockers: [],
    questions: [],
    outputs: [],
    sessions: [],
    memory: [],
  };
}

/**
 * Load metadata from file
 */
export function loadMetadata(path) {
  if (!existsSync(path)) {
    throw new Error(`Metadata file not found: ${path}`);
  }

  try {
    const content = readFileSync(path, "utf8");
    const data = JSON.parse(content);

    // Validate after loading
    const errors = validateMetadata(data);
    if (errors.length > 0) {
      throw new Error(
        `Invalid metadata: ${errors.map((e) => `${e.field}: ${e.message}`).join(", ")}`
      );
    }

    return data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Corrupted metadata file (invalid JSON): ${path}`);
    }
    throw error;
  }
}

/**
 * Save metadata to file
 */
export function saveMetadata(path, metadata) {
  // Validate before saving
  const errors = validateMetadata(metadata);
  if (errors.length > 0) {
    throw new Error(
      `Cannot save invalid metadata: ${errors.map((e) => `${e.field}: ${e.message}`).join(", ")}`
    );
  }

  // Update timestamp
  metadata.updated = new Date().toISOString();

  // Ensure directory exists
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Write atomically (write to temp, then rename)
  const tempPath = `${path}.tmp`;
  try {
    writeFileSync(tempPath, JSON.stringify(metadata, null, 2), "utf8");
    writeFileSync(path, readFileSync(tempPath, "utf8"), "utf8");
    unlinkSync(tempPath);
  } catch (error) {
    if (existsSync(tempPath)) {
      try {
        unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    throw error;
  }
}

/**
 * Validate metadata structure
 */
export function validateMetadata(metadata) {
  const errors = [];

  // Required string fields
  const requiredStrings = [
    "name",
    "displayName",
    "outcome",
    "stage",
    "nextAction",
    "created",
    "updated",
  ];

  for (const field of requiredStrings) {
    if (!metadata[field] || typeof metadata[field] !== "string") {
      errors.push({
        field,
        message: `Required string field missing or invalid`,
      });
    }
  }

  // Validate name format
  if (metadata.name && !isValidKebabCase(metadata.name)) {
    errors.push({
      field: "name",
      message: "Must be kebab-case (lowercase, hyphens only)",
    });
  }

  // Validate stage
  const validStages = ["planning", "building", "blocked", "review", "paused", "done"];
  if (metadata.stage && !validStages.includes(metadata.stage)) {
    errors.push({
      field: "stage",
      message: `Must be one of: ${validStages.join(", ")}`,
    });
  }

  // Required arrays
  const requiredArrays = [
    "constraints",
    "definitionOfDone",
    "progress",
    "decisions",
    "blockers",
    "questions",
    "outputs",
    "sessions",
    "memory",
  ];

  for (const field of requiredArrays) {
    if (!Array.isArray(metadata[field])) {
      errors.push({
        field,
        message: "Must be an array",
      });
    }
  }

  // Validate timestamps
  if (metadata.created && !isValidISO8601(metadata.created)) {
    errors.push({
      field: "created",
      message: "Must be a valid ISO 8601 timestamp",
    });
  }

  if (metadata.updated && !isValidISO8601(metadata.updated)) {
    errors.push({
      field: "updated",
      message: "Must be a valid ISO 8601 timestamp",
    });
  }

  // Validate definition of done items
  if (Array.isArray(metadata.definitionOfDone)) {
    metadata.definitionOfDone.forEach((item, index) => {
      if (!item.criterion || typeof item.criterion !== "string") {
        errors.push({
          field: `definitionOfDone[${index}].criterion`,
          message: "Required string field missing",
        });
      }
      if (typeof item.completed !== "boolean") {
        errors.push({
          field: `definitionOfDone[${index}].completed`,
          message: "Must be a boolean",
        });
      }
    });
  }

  // Validate progress entries
  if (Array.isArray(metadata.progress)) {
    metadata.progress.forEach((item, index) => {
      if (!item.timestamp || !isValidISO8601(item.timestamp)) {
        errors.push({
          field: `progress[${index}].timestamp`,
          message: "Must be a valid ISO 8601 timestamp",
        });
      }
      if (!item.entry || typeof item.entry !== "string") {
        errors.push({
          field: `progress[${index}].entry`,
          message: "Required string field missing",
        });
      }
    });
  }

  // Validate decisions
  if (Array.isArray(metadata.decisions)) {
    metadata.decisions.forEach((item, index) => {
      if (!item.timestamp || !isValidISO8601(item.timestamp)) {
        errors.push({
          field: `decisions[${index}].timestamp`,
          message: "Must be a valid ISO 8601 timestamp",
        });
      }
      if (!item.decision || typeof item.decision !== "string") {
        errors.push({
          field: `decisions[${index}].decision`,
          message: "Required string field missing",
        });
      }
      if (!item.rationale || typeof item.rationale !== "string") {
        errors.push({
          field: `decisions[${index}].rationale`,
          message: "Required string field missing",
        });
      }
    });
  }

  return errors;
}

/**
 * Check if name is valid kebab-case
 */
export function isValidKebabCase(name) {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name);
}

/**
 * Convert string to kebab-case
 */
export function toKebabCase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/**
 * Check if string is valid ISO 8601 timestamp
 */
function isValidISO8601(timestamp) {
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) && date.toISOString() === timestamp;
}

/**
 * Suggest initiative name from description/goal
 */
export function suggestInitiativeName(description, goal) {
  const text = goal ? `${description} ${goal}` : description;
  return toKebabCase(text);
}

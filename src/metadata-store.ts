/**
 * Metadata Store - CRUD operations for .forge/metadata.json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { Metadata, MetadataValidationError, Stage } from "./types.js";

/**
 * Create a new metadata object with default values
 */
export function createMetadata(
  name: string,
  displayName: string,
  outcome?: string
): Metadata {
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
  };
}

/**
 * Load metadata from file
 */
export function loadMetadata(path: string): Metadata {
  if (!existsSync(path)) {
    throw new Error(`Metadata file not found: ${path}`);
  }

  try {
    const content = readFileSync(path, "utf8");
    const data = JSON.parse(content) as Metadata;

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
export function saveMetadata(path: string, metadata: Metadata): void {
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
  } finally {
    if (existsSync(tempPath)) {
      try {
        const fs = await import("node:fs/promises");
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Validate metadata structure
 */
export function validateMetadata(metadata: any): MetadataValidationError[] {
  const errors: MetadataValidationError[] = [];

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
  const validStages: Stage[] = ["planning", "building", "blocked", "review", "paused", "done"];
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
    metadata.definitionOfDone.forEach((item: any, index: number) => {
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
    metadata.progress.forEach((item: any, index: number) => {
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
    metadata.decisions.forEach((item: any, index: number) => {
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
export function isValidKebabCase(name: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name);
}

/**
 * Convert string to kebab-case
 */
export function toKebabCase(str: string): string {
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
function isValidISO8601(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) && date.toISOString() === timestamp;
}

/**
 * Suggest initiative name from description/goal
 */
export function suggestInitiativeName(description: string, goal?: string): string {
  const text = goal ? `${description} ${goal}` : description;
  return toKebabCase(text);
}

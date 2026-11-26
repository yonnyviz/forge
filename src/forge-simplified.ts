/**
 * Simplified Forge Extension - Two-File Pattern
 * metadata.json (data) + AGENTS.md (protocol)
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Metadata } from "./types.js";
import {
  createMetadata,
  loadMetadata,
  saveMetadata,
  isValidKebabCase,
  toKebabCase,
  suggestInitiativeName,
} from "./metadata-store.js";
import { generateAgentsMd } from "./agents-template.js";

const INITIATIVES_DIR = resolve(
  process.env.FORGE_INITIATIVES_DIR || "~/Documents/initiatives"
).replace(/^~/, process.env.HOME || "");

function ensureInitiativesDir() {
  if (!existsSync(INITIATIVES_DIR)) {
    mkdirSync(INITIATIVES_DIR, { recursive: true });
  }
}

export default function (pi: ExtensionAPI) {
  // Single command: /forge
  pi.registerCommand("forge", {
    description: "Manage initiatives (simplified two-file pattern)",
    handler: async (args, ctx) => {
      try {
        ensureInitiativesDir();

        // Check if we have a subcommand
        const subcommand = args._?.[0] as string | undefined;

        if (subcommand === "new") {
          // /forge new "Description"
          const description = args._?.slice(1).join(" ") || "";
          await createInitiativeFlow(description, ctx, pi);
        } else {
          // Default: show main menu
          await mainMenu(ctx, pi);
        }
      } catch (error) {
        ctx.ui.notify(
          `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          "error"
        );
      }
    },
  });
}

/**
 * Main menu - list initiatives or create new
 */
async function mainMenu(ctx: ExtensionCommandContext, pi: ExtensionAPI) {
  const currentInitiative = getCurrentInitiative(ctx.cwd);

  if (currentInitiative) {
    // Inside an initiative - show management options
    ctx.ui.notify(
      `🔨 ${currentInitiative.data.displayName}\n\nStage: ${currentInitiative.data.stage}\nNext: ${currentInitiative.data.nextAction}`,
      "info"
    );
    return;
  }

  // Outside an initiative - show list or create
  const initiatives = listInitiatives();

  const options = [
    "➕ Create new initiative",
    ...initiatives.map((init) => `📂 ${init.displayName} · ${init.stage} · ${init.name}`),
  ];

  const choice = await ctx.ui.select("🔨 Forge Initiatives", options);
  if (!choice) return;

  if (choice === "➕ Create new initiative") {
    await createInitiativeFlow("", ctx, pi);
  } else {
    // Switch to selected initiative
    const index = options.indexOf(choice) - 1;
    const selected = initiatives[index];
    if (selected) {
      const initPath = join(INITIATIVES_DIR, selected.name);
      await switchToInitiative(ctx, initPath, selected.displayName);
    }
  }
}

/**
 * Create a new initiative
 */
async function createInitiativeFlow(
  description: string,
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI
) {
  // Get description if not provided
  if (!description.trim()) {
    description = await ctx.ui.input("What are you building/solving?", "");
    if (!description.trim()) {
      ctx.ui.notify("Cancelled", "info");
      return;
    }
  }

  // Auto-suggest name
  const suggestedName = suggestInitiativeName(description);
  let initName = await ctx.ui.input("Initiative name (kebab-case):", suggestedName);
  initName = initName.trim();

  if (!initName) {
    ctx.ui.notify("Cancelled", "info");
    return;
  }

  // Validate and fix name
  if (!isValidKebabCase(initName)) {
    const fixed = toKebabCase(initName);
    const ok = await ctx.ui.confirm(
      "Invalid name",
      `Name contains invalid characters. Use '${fixed}' instead?`
    );
    if (!ok || !fixed) {
      ctx.ui.notify("Cancelled", "info");
      return;
    }
    initName = fixed;
  }

  const initPath = join(INITIATIVES_DIR, initName);
  if (existsSync(initPath)) {
    ctx.ui.notify(`Initiative '${initName}' already exists`, "error");
    return;
  }

  // Create metadata
  const metadata = createMetadata(initName, description, description);

  // Create directory structure
  mkdirSync(join(initPath, ".forge"), { recursive: true });
  mkdirSync(join(initPath, "outputs"), { recursive: true });

  // Save metadata.json
  const metadataPath = join(initPath, ".forge", "metadata.json");
  saveMetadata(metadataPath, metadata);

  // Generate AGENTS.md
  const agentsMd = generateAgentsMd(metadata);
  writeFileSync(join(initPath, "AGENTS.md"), agentsMd, "utf8");

  ctx.ui.notify(
    `✓ Initiative created: ${metadata.displayName}\n${initPath}`,
    "success"
  );

  // Offer to switch
  const switchNow = await ctx.ui.confirm(
    "Switch to it now?",
    "Start a fresh Pi session in the new initiative?"
  );

  if (switchNow) {
    await switchToInitiative(ctx, initPath, metadata.displayName);
  }
}

/**
 * Switch Pi session to an initiative
 */
async function switchToInitiative(
  ctx: ExtensionCommandContext,
  initPath: string,
  displayName: string
): Promise<boolean> {
  const target = resolve(initPath);

  if (!existsSync(join(target, ".forge", "metadata.json"))) {
    ctx.ui.notify(`Not a Forge initiative: ${target}`, "error");
    return false;
  }

  if (resolve(ctx.cwd) === target) {
    ctx.ui.notify(`Already in ${displayName}`, "info");
    return false;
  }

  try {
    await ctx.waitForIdle();

    // Create session in the initiative directory
    const sm = SessionManager.create(target);
    const file = sm.getSessionFile();
    const header = sm.getHeader();

    if (!file || !header) {
      ctx.ui.notify("Could not allocate a session file", "error");
      return false;
    }

    // Ensure file exists
    if (!existsSync(file)) {
      writeFileSync(file, `${JSON.stringify(header)}\n`, { flag: "wx" });
    }

    const { cancelled } = await ctx.switchSession(file, {
      withSession: async (next) => {
        next.ui.notify(`🔨 ${displayName}\n${target}`, "success");
      },
    });

    if (cancelled) {
      ctx.ui.notify("Switch cancelled", "info");
      return false;
    }

    return true;
  } catch (error) {
    ctx.ui.notify(
      `Switch failed: ${error instanceof Error ? error.message : String(error)}`,
      "error"
    );
    return false;
  }
}

/**
 * Get current initiative if cwd is inside one
 */
function getCurrentInitiative(cwd: string): { path: string; data: Metadata } | null {
  const metadataPath = join(cwd, ".forge", "metadata.json");
  if (!existsSync(metadataPath)) return null;

  try {
    const data = loadMetadata(metadataPath);
    return { path: metadataPath, data };
  } catch {
    return null;
  }
}

/**
 * List all initiatives
 */
function listInitiatives(): Metadata[] {
  if (!existsSync(INITIATIVES_DIR)) return [];

  const { readdirSync } = require("node:fs");
  const initiatives: Metadata[] = [];

  for (const entry of readdirSync(INITIATIVES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const metadataPath = join(INITIATIVES_DIR, entry.name, ".forge", "metadata.json");
    if (existsSync(metadataPath)) {
      try {
        initiatives.push(loadMetadata(metadataPath));
      } catch {
        // Skip invalid initiatives
      }
    }
  }

  // Sort by last updated
  initiatives.sort((a, b) => 
    new Date(b.updated).getTime() - new Date(a.updated).getTime()
  );

  return initiatives;
}

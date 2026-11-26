# Initiative Workflow Support

## Purpose

Add lightweight, durable initiative workflow support to Forge. Forge provides storage, navigation, sessions, and the launcher; the workflow defines proportionate intake, durable context, resume behavior, and clean handoffs.

## Scope

**In scope**

- Persistent initiative records based on `brief.md` and `memory.md`.
- A compact metadata index optimized for agent resume.
- Proportionate quick-task and persistent-initiative paths.
- Consistent behavior in the Pi extension and Forge CLI.
- Legacy initiative compatibility and opt-in migration.

**Out of scope**

- Dashboard implementation or changes.
- Automatic destructive migration of existing initiatives.
- Creating roadmap, milestones, ADRs, research, or task folders by default.

## Architecture decisions

### D1: Markdown documents are authoritative

`brief.md` defines outcome, definition of done, scope, constraints, and affected areas. `memory.md` holds durable facts, decisions and rationale, progress, open questions, and next action.

`.forge/metadata.json` is an index and operational summary, not a second canonical copy of either document.

### D2: Metadata provides an agent entry point

Persistent initiatives use `schemaVersion: 2` metadata with exact document locations and a compact resume card:

```json
{
  "schemaVersion": 2,
  "name": "initiative-workflow",
  "status": "active",
  "documents": {
    "brief": "brief.md",
    "memory": "memory.md",
    "outputs": "outputs/"
  },
  "agent": {
    "readOrder": ["brief.md", "memory.md"],
    "nextAction": "Define shared document read/write helpers.",
    "affectedPaths": [
      "src/forge.ts",
      "src/initiative-store.js",
      "bin/forge.js"
    ]
  }
}
```

`agent.nextAction` is a rebuildable cache mirrored from `memory.md`. Forge writes the authoritative Markdown document first, then updates metadata; readers must prefer `memory.md` if the cache is stale. Full brief and memory content must not be embedded in metadata, to avoid duplicated sources of truth.

### D3: Documents are compact and agent-readable

Each document begins with a bounded JSON context block for fast scanning without adding a YAML parser dependency. Any Markdown body supplies only supporting context that does not fit the compact fields.

Example `brief.md`:

```md
<!-- forge-context
{"type":"forge/brief","version":1,"outcome":"Add proportional, durable initiative workflow support.","definitionOfDone":["Persistent initiatives use brief.md and memory.md."],"scope":{"in":["creation","resume","CLI parity"],"out":["dashboard","automatic migration"]},"constraints":["Do not interrupt dashboard work."],"affectedPaths":["src/forge.ts","src/initiative-store.js","bin/forge.js"]}
-->

# Brief
```

Example `memory.md`:

```md
<!-- forge-context
{"type":"forge/memory","version":1,"status":"active","nextAction":"Define shared document read/write helpers.","blockers":[],"openQuestions":["Should quick tasks create any on-disk record?"],"decisions":[{"id":"D1","decision":"Metadata indexes documents; Markdown is authoritative.","rationale":"Avoid duplicated, stale context."}]}
-->

# Memory
```

### D4: Structure expands only when justified

A persistent initiative begins with:

```text
initiative/
├── .forge/
│   ├── metadata.json
│   └── sessions.log
├── brief.md
├── memory.md
├── outputs/
└── sessions/             # created when session tracking is used
```

`research/`, `tasks/`, codebase-local planning folders, and detailed documentation are created only through an explicit expansion action when the work needs them.

### D5: Separate quick tasks from persistent initiatives

A quick, one-session task should remain in the Pi conversation or an optional single session note. Forge should not impose an initiative directory and full record on work that does not benefit from continuity.

### D6: Legacy records remain readable

Existing Forge initiatives continue to use `.forge/metadata.json` for discovery. If `brief.md` and `memory.md` do not exist, Forge treats the initiative as legacy and can offer an explicit, non-destructive migration based on existing metadata, README, `.claude.md`, and recent sessions.

### D7: An active Pi process cannot switch initiative roots

Pi's working directory is fixed for the lifetime of a process. `/forge` may manage records for another initiative, but it must not imply that the current agent has moved there.

The Forge CLI is the workspace-switch boundary: it starts or resumes a Pi process with the chosen initiative root as its working directory. The in-Pi extension supports only the initiative rooted at the current Pi working directory; when a user selects another initiative, it must offer an explicit handoff with the exact CLI command to launch after exiting Pi.

Forge state and the status bar must represent the initiative associated with the current working directory, not the last initiative selected in a menu.

### D8: Intake stays high-level and generated names stay short

Initiative creation asks for only a high-level description and intended goal before suggesting a name. Forge derives a concise default identifier from up to three meaningful words, removes common stop words, and caps the generated name at 32 characters. Users may still provide a custom kebab-case name.

## Agent resume protocol

When opening a persistent initiative, Forge should:

1. Read `.forge/metadata.json`.
2. Read the files named in `agent.readOrder`.
3. Present outcome, status, decisions, open questions, next action, and affected paths.
4. Read session notes or repository files only as required by those documents.

A file format alone does not add context to an agent session. The extension and CLI must deliberately follow this protocol when starting or resuming work.

## Milestone 1: Shared record foundation

- [x] Define metadata v2 types and validation.
- [x] Add shared functions to create, parse, and update `brief.md` and `memory.md`.
- [x] Add atomic per-file writes with authoritative Markdown-first cache updates.
- [x] Create minimal templates with JSON context blocks.
- [x] Ensure metadata pointers and cached `agent.nextAction` are updated from the authoritative memory record.
- [x] Add tests for creation, parsing, validation, and memory updates.

**Done when:** a shared store API can create, read, and update a persistent initiative without the Pi extension or CLI duplicating file logic. **Status: complete.**

## Milestone 2: Proportionate creation flows

- [x] Replace the current detail-heavy creation intake with a high-level description and intended goal.
- [x] Derive a short slug from the description and allow confirmation.
- [x] Add a quick-task path with no required persistent initiative record.
- [x] Create the minimal persistent structure only when continuity is selected.
- [x] Reuse the same shared creation API in `src/forge.ts` and `bin/forge.js`.
- [x] Keep `/forge` scoped to the current Pi working directory; do not mark another selected initiative as active.
- [x] Add a non-interactive CLI launch form that can reopen a named initiative/session from an in-Pi handoff.

**Done when:** the CLI and Pi extension produce equivalent persistent records, neither creates planning/ADR scaffolding by default, and switching roots always launches a separate Pi process. **Status: complete.**

## Milestone 3: Context-first resume and lifecycle

- [ ] Load the metadata resume card, brief, and memory before session notes.
- [ ] Add pause, handoff, and completion flows.
- [ ] Capture durable decisions, progress, open questions, and next action in `memory.md`.
- [ ] Store final handoff and implementation artifacts in `outputs/` only when useful.
- [ ] Keep session notes as chronology and supporting detail, not canonical initiative context.

**Done when:** resuming an initiative immediately identifies its goal, current next action, constraints, and relevant source paths.

## Milestone 4: Legacy compatibility

- [x] Detect legacy initiatives without the v2 documents.
- [x] Preserve existing README, `.claude.md`, roadmap, ADR, session, and artifact files.
- [x] Offer dry-run and explicitly confirmed migration; never migrate automatically.
- [x] Back up original metadata before activating schema v2.
- [x] Block migration rather than overwrite conflicting `brief.md` or `memory.md` files.
- [x] Test missing, malformed, and partially migrated records.

**Done when:** old Forge initiatives remain usable and migration never deletes or overwrites useful history. **Status: complete.**

## Verification

- [x] Unit-test document templates, parsing, metadata pointers, and update behavior.
- [x] Unit-test quick versus persistent CLI workflow selection.
- [x] Unit-test legacy detection, dry-run, confirmed migration, conflicts, and partial migration.
- [x] Exercise the `forge` CLI creation and launch flows.
- [x] Confirm this branch has no dependency on dashboard files or behavior.

## Current next action

Begin Milestone 3: load metadata, `brief.md`, and `memory.md` into the context-first resume flow.

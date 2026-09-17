# 🔨 Forge Extension

The Forge extension manages initiatives and work sessions with structured metadata and tracking.

## Installation

Pi discovers this extension automatically via the git package system. No manual copying required.

### 1. Add Git Package to Pi Settings

Edit `~/.pi/agent/settings.json` and add the Forge repository:

```json
{
  "packages": [
    "git:github.com/yonnyviz/forge@main"
  ]
}
```

If the file doesn't exist, create it with the above content.

### 2. Reload Pi

Inside Pi, run:
```
/reload
```

Pi will:
- Fetch the Forge repository
- Read `package.json` to find the extension entry point
- Auto-discover and load `src/forge.ts`
- Register the `/forge` command

### 3. Set Initiatives Directory (Optional)

By default, initiatives are stored in `~/Documents/initiatives`. To use a different location:

```bash
export FORGE_INITIATIVES_DIR=/path/to/your/initiatives
```

Add this to your shell profile (`.bashrc`, `.zshrc`, etc.) to persist across sessions:

```bash
# ~/.zshrc or ~/.bashrc
export FORGE_INITIATIVES_DIR="$HOME/Documents/initiatives"
```

Or set it inline before running Pi:

```bash
FORGE_INITIATIVES_DIR=$HOME/my-initiatives pi
```

### 4. Verify Installation

Run `/forge` to open the main workflow menu. If successful, you'll see the initiative selection prompt.

---

## Launch Pi for an Initiative

The Forge CLI is the recommended way to begin or resume work. It starts a **normal Pi process** in the selected initiative directory; it does not try to change the working directory of an already-running Pi process.

Install the CLI separately from the Pi git package:

```bash
npm install -g git+https://github.com/yonnyviz/forge.git
forge
```

For local development, run `npm link` in this repository once, then use `forge`.

### Launcher flow

1. `forge` opens a workflow menu from `FORGE_INITIATIVES_DIR`.
2. You can start a quick task, create a persistent initiative, or select an existing one.
3. Forge lets you create a new work session or select an existing one.
4. New sessions create `sessions/YYYY-MM-DD_name/notes.md`, update `.forge/metadata.json`, and get logged.
5. Forge starts Pi in the initiative root with a deterministic display name: `initiative-name — YYYY-MM-DD_session-name` and a stable session ID.
6. Selecting an existing session reopens the same Pi session instead of creating a duplicate.
7. To switch roots from an active Pi process, exit Pi and run `forge launch <initiative-name> [session-folder]`.

For example, `forge-implementation` and a Forge session folder named `2026-09-16_cli-launcher` produce the Pi session name `forge-implementation — 2026-09-16_cli-launcher`.

The Forge CLI waits while Pi is open and returns when Pi exits. Set `FORGE_PI_BIN` to use a different Pi executable while testing, for example `FORGE_PI_BIN=/path/to/pi forge`.

To explicitly switch from another active Pi process, exit it and run:

```bash
forge launch initiative-name
forge launch initiative-name 2026-09-17_session-name
```

Without a session folder, Forge creates a new session. With a session folder, it reopens that session.

## How It Works

Pi's extension discovery system finds extensions from:
- **Auto-discovery locations:** `~/.pi/agent/extensions/` (global, project-local `.pi/extensions/`)
- **Git packages:** Referenced in `settings.json` with `git:` prefix
- **NPM packages:** Referenced with `npm:` prefix

This extension uses the **git package** approach:
1. `package.json` declares `pi.extensions` pointing to `./src/forge.ts`
2. Pi clones the repo and reads `package.json`
3. The TypeScript extension auto-loads via jiti (no build step needed)
4. Changes to the repo are picked up on next `/reload`

## Configuration

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|----------|
| `FORGE_INITIATIVES_DIR` | `~/Documents/initiatives` | Root directory for all initiatives |

### Examples

```bash
# Use default location
/forge

# Use custom location (set before starting Pi)
export FORGE_INITIATIVES_DIR="$HOME/Projects/work"
pi

# Or inline
FORGE_INITIATIVES_DIR="$HOME/initiatives" pi
```

## Usage

### Start Forge
```
/forge
```

This opens the main workflow menu with options to:
- ⚡ Continue as a quick task without creating a Forge record
- ➕ Create a persistent initiative
- View and manage the initiative rooted at the current Pi directory
- Exit and launch another initiative through the CLI

### Create Initiative

1. Run `/forge` or `forge`
2. Select persistent initiative creation
3. Describe the outcome, definition of done, and relevant context or constraints
4. Confirm the suggested kebab-case name
5. Optionally create the first session

Forge creates a compact record with `brief.md`, `memory.md`, and an agent-oriented metadata index. It does not create planning, milestone, ADR, or artifact scaffolding by default.

**Folder structure created:**
```
my-project/
├── .forge/
│   ├── metadata.json
│   └── sessions.log
├── brief.md
├── memory.md
└── outputs/
```

`sessions/` is created when the first work session is started.

### Create Session

1. Select an initiative
2. Choose "➕ Create new session"
3. Enter session name (kebab-case)
4. Optionally name your Pi session
5. A `notes.md` template is created in `sessions/YYYY-MM-DD_name/`

> To launch a separate Pi instance rooted at the initiative directory, use the `forge` CLI described above.

### Resume Session

1. Select an initiative
2. Choose "▶️ Resume session"
3. Select from recent sessions
4. Session notes preview is shown

### Update Status

1. Select an initiative
2. Choose "⚙️ Update status"
3. Change status: Active, Paused, Blocked, or Completed
4. Add progress summary (optional)

## File Structure

- **`.forge/metadata.json`** - Identity, status, timestamps, document pointers, and agent resume index
- **`brief.md`** - Outcome, definition of done, scope, constraints, and affected paths
- **`memory.md`** - Durable context, decisions, progress, open questions, and next action
- **`outputs/`** - Useful handoff and delivery artifacts
- **`sessions/YYYY-MM-DD_name/`** - Optional session chronology and notes

Legacy initiatives may also contain `.claude.md`, `README.md`, planning files, and ADRs; those remain supported.

## Metadata Fields

- `status`: active | paused | blocked | completed
- `phase`: planning | execution | review | complete
- `sessionCount`: Total sessions created
- `lastSession`: ISO timestamp of most recent session
- `relatedInitiatives`: Array of related initiative names

## State Management

The extension derives the active initiative from Pi's current working directory:
- Status bar displays: 🔨 current-initiative-name
- A running Pi process cannot switch to another initiative root
- Exit Pi and use `forge launch` to open another initiative
- Legacy session state is cleared when the current directory is not an initiative

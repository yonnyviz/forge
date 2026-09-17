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

The Forge CLI is the recommended way to begin new work. It starts a **new, normal Pi process** in the selected initiative directory; it does not try to change the working directory of an already-running Pi session.

Install the CLI separately from the Pi git package:

```bash
npm install -g git+https://github.com/yonnyviz/forge.git
forge
```

For local development, run `npm link` in this repository once, then use `forge`.

### Launcher flow

1. `forge` lists initiatives from `FORGE_INITIATIVES_DIR`.
2. You select an initiative and give the work session a name.
3. Forge creates `sessions/YYYY-MM-DD_name/notes.md`, updates `.forge/metadata.json`, and logs the session.
4. Forge starts Pi in the initiative root with a deterministic display name: `initiative-name — YYYY-MM-DD_session-name`.
5. Pi performs its usual context discovery and saves its own session under that working directory.

For example, `forge-implementation` and a Forge session folder named `2026-09-16_cli-launcher` produce the Pi session name `forge-implementation — 2026-09-16_cli-launcher`.

The Forge CLI waits while Pi is open and returns when Pi exits. Set `FORGE_PI_BIN` to use a different Pi executable while testing, for example `FORGE_PI_BIN=/path/to/pi forge`.

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
- ➕ Create new initiative
- Select an existing initiative
- Resume sessions
- Update status

### Create Initiative

1. Run `/forge`
2. Select "➕ Create new initiative"
3. Enter kebab-case name (e.g., `my-project`)
4. Provide display name, description, goal, and tags
5. Optionally create your first session

**Folder structure created:**
```
my-project/
├── .forge/
│   ├── metadata.json
│   └── sessions.log
├── sessions/
├── planning/milestones/
├── docs/
├── artifacts/
├── .claude.md
└── README.md
```

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

- **`.forge/metadata.json`** - Initiative metadata (status, phase, owner, tags, session count)
- **`.claude.md`** - Navigation and context for Claude
- **`README.md`** - Public initiative overview
- **`planning/ROADMAP.md`** - Milestone index and dependencies
- **`docs/DECISIONS.md`** - Architecture decision records
- **`sessions/YYYY-MM-DD_name/`** - Session work logs

## Metadata Fields

- `status`: active | paused | blocked | completed
- `phase`: planning | execution | review | complete
- `sessionCount`: Total sessions created
- `lastSession`: ISO timestamp of most recent session
- `relatedInitiatives`: Array of related initiative names

## State Management

The extension stores active initiative state in the Pi session, restored on session start:
- Status bar displays: 🔨 active-initiative-name
- State persists across Pi sessions

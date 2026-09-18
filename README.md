# 🔨 Forge Extension

Manage initiatives and work sessions inside Pi with structured metadata and tracking.

## 📑 Contents

- [Quick Start](#-quick-start)
- [`/forge` Command](#-forge-command)
- [Installation](#-installation)
- [CLI Launcher](#-cli-launcher)
- [How It Works](#-how-it-works)
- [Configuration](#-configuration)
- [File Structure](#-file-structure)
- [Metadata Fields](#-metadata-fields)
- [State Management](#-state-management)

---

## ⚡ Quick Start

```bash
# 1. Add the git package to Pi settings (~/.pi/agent/settings.json)
{ "packages": ["git:github.com/yonnyviz/forge@main"] }

# 2. Reload Pi
/reload

# 3. Run Forge
/forge
```

---

## 🚀 `/forge` Command

Run `/forge` inside Pi to open the main workflow menu.

| Action | Description |
|---|---|
| ⚡ **Quick task** | Work without creating a Forge record |
| ➕ **Create initiative** | Start a new persistent initiative |
| 📂 **Manage current initiative** | View/manage the initiative rooted at the current Pi directory |
| ▶️ **Resume session** | Pick up a recent session |
| ⚙️ **Update status** | Change status: Active, Paused, Blocked, Completed |
| 🔁 **Exit & switch** | Exit and launch another initiative via CLI |

### 📝 Common workflows

**Create an initiative**
1. `/forge` → select persistent initiative creation
2. Describe the goal → confirm the suggested kebab-case name
3. Optionally start the first session

Creates: `.forge/metadata.json`, `.forge/sessions.log`, `AGENTS.md`, `brief.md`, `memory.md`, `outputs/`
(No planning/milestone/ADR scaffolding by default.)

**Create a session**
1. Select an initiative → "➕ Create new session"
2. Enter session name (kebab-case), optionally name the Pi session
3. Template created at `sessions/YYYY-MM-DD_name/notes.md`

**Resume a session**
1. Select an initiative → "▶️ Resume session"
2. Choose from recent sessions → notes preview is shown

**Update status**
1. Select an initiative → "⚙️ Update status"
2. Set Active / Paused / Blocked / Completed + optional progress note

**Migrate a legacy initiative**
```bash
forge migrate initiative-name --dry-run   # preview
forge migrate initiative-name             # apply
```
Creates missing `brief.md`/`memory.md`/`outputs/`, upgrades metadata to schema v2, backs up old metadata as `.forge/metadata.pre-v2*.json`. Existing docs (README, `.claude.md`, roadmap, decisions, sessions, artifacts) are preserved. A conflicting `brief.md`/`memory.md` blocks migration instead of overwriting.

> Inside an initiative-rooted Pi process, `/forge` offers **Preview workflow migration** for legacy records.

---

## 📦 Installation

Pi discovers this extension automatically via the git package system — no manual copying required.

### 1. Add the git package

Edit `~/.pi/agent/settings.json` (create it if missing):

```json
{
  "packages": [
    "git:github.com/yonnyviz/forge@main"
  ]
}
```

### 2. Reload Pi

```
/reload
```

Pi will fetch the repo, read `package.json`, auto-load `src/forge.ts`, and register `/forge`.

### 3. (Optional) Set initiatives directory

Default location: `~/Documents/initiatives`

```bash
export FORGE_INITIATIVES_DIR="$HOME/Documents/initiatives"   # add to ~/.zshrc or ~/.bashrc
# or inline:
FORGE_INITIATIVES_DIR=$HOME/my-initiatives pi
```

### 4. Verify

Run `/forge` — you should see the initiative selection prompt.

---

## 🖥️ CLI Launcher

The Forge CLI starts a **normal Pi process** in the selected initiative directory (it does not change the directory of an already-running Pi process).

```bash
npm install -g git+https://github.com/yonnyviz/forge.git
forge
```
For local dev: run `npm link` in this repo, then use `forge`.

### Flow

1. `forge` opens a workflow menu from `FORGE_INITIATIVES_DIR`
2. Start a quick task, create an initiative, or select an existing one
3. Create a new session or select an existing one
4. New sessions create `sessions/YYYY-MM-DD_name/notes.md`, update metadata, and get logged
5. Pi starts in the initiative root with display name `initiative-name — YYYY-MM-DD_session-name` and a stable session ID
6. Selecting an existing session reopens it (no duplicates)
7. To switch roots from an active Pi process, exit Pi and run `forge launch <initiative-name> [session-folder]`

```bash
forge launch initiative-name
forge launch initiative-name 2026-09-17_session-name
```
Without a session folder → creates a new session. With one → reopens that session.

💡 The CLI waits while Pi is open and returns when Pi exits. Use `FORGE_PI_BIN=/path/to/pi forge` to test with a different Pi executable.

---

## ⚙️ How It Works

Pi discovers extensions from:
- **Auto-discovery:** `~/.pi/agent/extensions/` (global), `.pi/extensions/` (project-local)
- **Git packages:** `git:` prefix in `settings.json`
- **NPM packages:** `npm:` prefix

Forge uses the **git package** approach:
1. `package.json` declares `pi.extensions` → `./src/forge.ts`
2. Pi clones the repo and reads `package.json`
3. The TypeScript extension auto-loads via jiti (no build step)
4. Changes are picked up on the next `/reload`

---

## 🔧 Configuration

| Variable | Default | Purpose |
|---|---|---|
| `FORGE_INITIATIVES_DIR` | `~/Documents/initiatives` | Root directory for all initiatives |
| `FORGE_PI_BIN` | `pi` | Alternate Pi executable used by the CLI launcher |

```bash
/forge                                          # default location
export FORGE_INITIATIVES_DIR="$HOME/Projects/work" && pi   # custom location
FORGE_INITIATIVES_DIR="$HOME/initiatives" pi     # inline
```

---

## 🗂️ File Structure

| Path | Purpose |
|---|---|
| `AGENTS.md` | **Pi context file:** workspace map, reading protocol, current state (auto-generated) |
| `.forge/metadata.json` | Identity, status, timestamps, document pointers, agent resume index |
| `brief.md` | Outcome, definition of done, scope, constraints, affected paths |
| `memory.md` | Durable context, decisions, progress, open questions, next action |
| `outputs/` | Useful handoff/delivery artifacts |
| `sessions/YYYY-MM-DD_name/` | Optional session chronology and notes |

**AGENTS.md** is automatically loaded by Pi from the current directory at startup, so any agent launched inside an initiative gets the workspace guide without needing to invoke `/forge`. The file is fenced by `<!-- forge:agents-guide start/end -->` markers; user-written prose outside those markers is preserved. Regenerate it via `/forge` → **📄 Refresh AGENTS.md**.

Legacy initiatives may also contain `.claude.md`, `README.md`, planning files, and ADRs — these remain supported.

---

## 🏷️ Metadata Fields

| Field | Values / Type |
|---|---|
| `status` | `active` \| `paused` \| `blocked` \| `completed` |
| `phase` | `planning` \| `execution` \| `review` \| `complete` |
| `sessionCount` | Total sessions created |
| `lastSession` | ISO timestamp of most recent session |
| `relatedInitiatives` | Array of related initiative names |

---

## 🔄 State Management

The extension derives the active initiative from Pi's current working directory:

- Status bar shows: `🔨 current-initiative-name`
- A running Pi process cannot switch to another initiative root
- Exit Pi and use `forge launch` to open another initiative
- Legacy session state is cleared when the current directory is not an initiative

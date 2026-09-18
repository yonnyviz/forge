# 🔨 Forge Extension

Manage initiatives and work sessions inside Pi with structured metadata and tracking.

## 📑 Contents

- [Quick Start](#-quick-start)
- [`/forge` Command](#-forge-command)
- [Installation](#-installation)
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

Run `/forge` inside Pi to open the initiative management workflow.

| Action | Description |
|---|---|
| ⚡ **Quick task** | Continue working without creating a Forge record |
| ➕ **Create initiative** | Start a new persistent initiative |
| 📂 **Manage current initiative** | View/manage the initiative rooted at the current Pi directory |
| ▶️ **Resume session** | Pick up a recent session |
| ⚙️ **Update status** | Change status: Active, Paused, Blocked, Completed |
| 🗑️ **Delete initiative** | Permanently remove an initiative |

### 📝 Common Workflows

**Create an initiative**
1. `/forge` → select persistent initiative creation
2. Describe the goal → confirm the suggested kebab-case name
3. Optionally switch to the new initiative immediately

Creates: `.forge/metadata.json`, `.forge/sessions.log`, `AGENTS.md`, `brief.md`, `memory.md`, `outputs/`

**Create a session**
1. `/forge` → select an initiative
2. Choose "➕ Start a new session"
3. Enter session name (kebab-case), optionally name the Pi session
4. Template created at `sessions/YYYY-MM-DD_name/notes.md`

**Resume a session**
1. `/forge` → select an initiative
2. Choose "▶️ Resume a recent session"
3. Select from recent sessions → notes preview is shown

**Update status**
1. `/forge` → select an initiative
2. Choose "⚙️ Update initiative status"
3. Set Active / Paused / Blocked / Completed + optional progress note

**Migrate a legacy initiative**
1. `/forge` → select a legacy initiative (one without `brief.md`/`memory.md`)
2. Choose "🔄 Preview workflow migration"
3. Review migration plan → confirm to apply

Creates missing `brief.md`/`memory.md`/`outputs/`, upgrades metadata to schema v2, backs up old metadata as `.forge/metadata.pre-v2*.json`. Existing docs (README, `.claude.md`, roadmap, decisions, sessions, artifacts) are preserved. A conflicting `brief.md`/`memory.md` blocks migration instead of overwriting.

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
- Use `/forge` to switch sessions or manage different initiatives
- Legacy session state is cleared when the current directory is not an initiative

---

## 📖 Session Workflow

When you run `/forge`:

1. **Initiative Selection**
   - See all initiatives sorted by recent activity
   - Current initiative (if in one) is marked with 🔨
   - Choose an initiative or create a new one

2. **Session Management**
   - Start a new session or resume an existing one
   - Sessions are timestamped: `YYYY-MM-DD_session-name`
   - Each session gets a notes template

3. **Context Integration**
   - `AGENTS.md` auto-loads as Pi context
   - Status bar shows active initiative
   - Session history tracked in `.forge/sessions.log`

4. **Session Switching**
   - Select a different initiative to switch Pi's working directory
   - Pi creates a fresh session in the new context
   - Previous session state is preserved

---

## 🛠️ Development

### Running Tests

```bash
npm test
```

Tests cover:
- Initiative creation and management
- Workflow document validation
- Legacy migration
- Session tracking
- Metadata integrity

### Extension Structure

```
forge/
├── src/
│   ├── forge.ts              # Pi extension entry point
│   └── initiative-store.js   # Core initiative logic
├── skills/
│   └── forge/                # Agent skill definitions
├── test/
│   └── initiative-workflow.test.js
└── package.json              # Extension manifest
```

---

## 📝 Migrating from CLI

**Previous CLI users:** The standalone `forge` CLI has been removed. All functionality is now available through the `/forge` command in Pi.

### Before (CLI removed in v0.1.0)
```bash
forge launch my-initiative
```

### Now (Pi Extension)
```bash
pi
/forge
# → Select initiative from menu
```

All initiative management now happens within Pi:
- No separate CLI to install
- Integrated session management
- Native Pi context switching
- Same features, better integration

---

## 🤝 Contributing

This extension follows Pi's git package conventions. Changes are auto-loaded on `/reload`.

1. Fork and clone the repository
2. Make your changes to `src/forge.ts` or `src/initiative-store.js`
3. Run tests: `npm test`
4. Update your `settings.json` to point to your fork
5. Run `/reload` in Pi to test changes

---

## 📄 License

MIT

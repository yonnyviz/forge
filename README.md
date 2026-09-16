# 🔨 Forge Extension

The Forge extension manages initiatives and work sessions with structured metadata and tracking.

## Installation

Pi discovers this extension automatically via the git package system. No manual copying required.

### 1. Add Git Package to Pi Settings

Edit `~/.pi/agent/settings.json` and add the worklog repository:

```json
{
  "packages": [
    "git:github.com/yonnyviz/worklog@main"
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
- Fetch the worklog repository
- Read `package.json` to find the extension entry point
- Auto-discover and load `src/forge.ts`
- Register the `/forge` command

### 3. Verify Installation

Run `/forge` to open the main workflow menu. If successful, you'll see the initiative selection prompt.

---

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
├── .worklog/
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

- **`.worklog/metadata.json`** - Initiative metadata (status, phase, owner, tags, session count)
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

# 🔨 Forge Extension

The Forge extension manages initiatives and work sessions with structured metadata and tracking.

## Installation

1. Copy the `forge.ts` file to your Pi extensions directory
2. The extension auto-registers the `/forge` command

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

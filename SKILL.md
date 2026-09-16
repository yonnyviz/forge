---
name: "worklog"
description: "Track initiatives and organize work sessions across multiple projects"
---

# Worklog Skill

## Overview

**Purpose:** Organize work by initiatives with persistent context, structured sessions, and AI memory.

**Working Location:** `/Users/yvizcaya/Documents/fujitsu/initiatives`

**Key Concepts:**
- **Initiative:** A project or goal with multiple work sessions
- **Session:** A time-bound work period within an initiative
- **Context:** AI-readable state maintained in `.claude.md`

---

## Folder Structure

Each initiative follows this structure:

```
initiatives/
└── [initiative-name]/
    ├── .worklog/
    │   ├── metadata.json      # Initiative tracking data
    │   └── sessions.log       # Session history index
    ├── .claude.md             # AI context & navigation
    ├── README.md              # Human-readable overview
    ├── sessions/
    │   └── YYYY-MM-DD_session-name/
    │       └── notes.md
    ├── planning/              # Goals, roadmap, strategy
    ├── docs/                  # Documentation, specs, references
    └── artifacts/             # Code, scripts, data, deliverables
```

**Folder Purposes:**
- `.worklog/` - Hidden metadata and session logs (machine-readable)
- `sessions/` - Date-stamped work session notes
- `planning/` - Milestone-based execution plans, roadmaps
- `docs/` - Technical documentation, specifications, **architecture decisions**
- `artifacts/` - Generated outputs, code, scripts, data

---

## .claude.md Template

The `.claude.md` file serves as AI memory and navigation index. Create with this template:

```markdown
# Initiative: [Initiative Name]

## 📂 Quick Navigation
- **Roadmap:** `planning/ROADMAP.md` - Milestone index & dependencies
- **Milestones:** `planning/milestones/` - Focused execution plans
- **Decisions:** `docs/DECISIONS.md` - Architecture decision records
- **Sessions:** `sessions/YYYY-MM-DD_name/` - Work logs & notes
- **Documentation:** `docs/` - Specs, requirements, references
- **Artifacts:** `artifacts/` - Code, scripts, data, deliverables
- **Metadata:** `.worklog/metadata.json` - Status & tracking

---

## 📋 Context

**What:** [Brief description of the initiative]

**Goal:** [Primary objective]

**Status:** [Active|Paused|Blocked|Completed]  
**Phase:** [Planning|Execution|Review|Complete]  
**Last Updated:** YYYY-MM-DD

---

## 📅 Recent Activity

**Latest Session:** YYYY-MM-DD - [Brief summary]

**Recent Progress:**
- [Key accomplishment 1]
- [Key accomplishment 2]

**Next Steps:**
- [ ] [Action item 1]
- [ ] [Action item 2]

---

## 🚧 Current Blockers
- [ ] [Blocker 1]
- [ ] [Blocker 2]

## ❓ Open Questions
- [ ] [Question 1]
- [ ] [Question 2]

---

## 🤖 AI Instructions

### 🛡️ File Creation Rules (MANDATORY)
**Before creating ANY file, validate against railguards:**

1. **Location:** Check allowed folders for file type
2. **Type:** Verify extension is permitted
3. **Naming:** Enforce kebab-case conventions
4. **Sequence:** Validate milestone/ADR numbering
5. **Immutability:** Never edit past sessions or ADRs

**Full rules:** See repository `RAILGUARDS.md`

### File Organization
- **Session notes:** `sessions/YYYY-MM-DD_description/notes.md` (ONLY .md/.txt/.log)
- **Code/scripts:** `artifacts/code/` or `artifacts/scripts/` (NEVER in sessions/planning/docs/)
- **Architecture decisions:** `docs/DECISIONS.md` (APPEND ONLY, never separate ADR files)
- **Technical docs:** `docs/*.md` (diagrams allowed)
- **Milestone plans:** `planning/milestones/m#-name.md` (sequential numbering)
- **Roadmap:** `planning/ROADMAP.md` (single master index)
- **Data/outputs:** `artifacts/data/` or `artifacts/outputs/`

### Session Workflow
1. **Start:** Read `.claude.md` → check railguards
2. **During:** Validate file location before saving
3. **End:** Write summary to `sessions/YYYY-MM-DD_name/notes.md`

### Naming Rules (ENFORCED)
- Sessions: `YYYY-MM-DD_kebab-case` (ISO date, lowercase, hyphens)
- Milestones: `m[1-9][0-9]*-kebab-case.md` (e.g., m1-setup.md)
- ADRs: `ADR-[001-999]` (zero-padded, sequential)
- Files: `kebab-case-name.ext` (no spaces, underscores, or capitals)

### Rejection Behavior
**When rules violated:**
```
❌ [Specific reason]
💡 Did you mean: [corrected option]
Accept correction? (y/n)
```

---

## 🔗 Related Initiatives
- [Other initiative]: [Relationship]

---

*Last updated: YYYY-MM-DD by worklog*
```

---

## metadata.json Schema

Store initiative metadata in `.worklog/metadata.json`:

```json
{
  "name": "initiative-name",
  "displayName": "Initiative Display Name",
  "description": "Brief description of the initiative",
  "goal": "Primary objective",
  "status": "active",
  "phase": "planning",
  "created": "2024-01-15T10:30:00Z",
  "lastSession": "2024-01-20T14:00:00Z",
  "lastUpdated": "2024-01-20T16:30:00Z",
  "owner": "yvizcaya",
  "tags": ["backend", "architecture"],
  "sessionCount": 5,
  "relatedInitiatives": []
}
```

**Field Descriptions:**
- `name`: Folder name (kebab-case)
- `displayName`: Human-readable name
- `status`: `active` | `paused` | `blocked` | `completed`
- `phase`: `planning` | `execution` | `review` | `complete`
- `sessionCount`: Number of sessions logged

---

## docs/DECISIONS.md Template

Architecture Decision Records (ADRs) live here as the **single source of truth** for technical choices.

```markdown
# Architecture Decisions

## ADR-001: [Decision Title]

**Date:** YYYY-MM-DD  
**Status:** Proposed | Accepted | Superseded | Deprecated  
**Author:** [Your Name]

### Context
What is the issue we're addressing? What is the motivation?

### Decision
What is the decision we're making?

### Rationale
Why are we choosing this option over alternatives?

### Consequences
What are the positive and negative impacts of this decision?

### Related Decisions
- ADR-002: [Related decision]

---

## ADR-002: [Decision Title]

**Date:** YYYY-MM-DD  
**Status:** Accepted  
**Author:** [Your Name]

### Context
...
```

**Key Rules:**
- One ADR per major decision
- Immutable history—don't edit, supersede instead
- Link from `.claude.md` and milestone plans
- Number sequentially (ADR-001, ADR-002, etc.)
- Include date & status for easy scanning

---

## planning/ROADMAP.md Template

Executive summary of milestones and their dependencies. Read this **first** to understand initiative scope.

```markdown
# Roadmap: [Initiative Name]

## 📋 Milestone Overview

| Milestone | Timeline | Dependencies | Status |
|-----------|----------|--------------|--------|
| M1: [Name] | Week 1-2 | — | Not Started |
| M2: [Name] | Week 1-2 | M1 | Not Started |
| M3: [Name] | Week 3 | M1, M2 | Not Started |

## 🔗 Dependency Graph

```
M1 ──┬
     ├──> M3 ──> M4
M2 ──┘
```

## 📋 Milestone Details

### M1: [Name]
**Timeline:** Week 1-2  
**Deliverable:** [What gets delivered]  
**Related ADR:** ADR-001, ADR-002  
**Plan:** See `milestones/m1-name.md`

### M2: [Name]
**Timeline:** Week 1-2  
**Deliverable:** [What gets delivered]  
**Related ADR:** ADR-003  
**Plan:** See `milestones/m2-name.md`

[Continue for all milestones]

---

## 📊 Success Criteria
- All milestones delivered on time
- [Specific metric]
- [Specific metric]
```

---

## planning/milestones/m#-name.md Template

Focused execution plan for a single milestone. Linked to architecture decisions and roadmap.

```markdown
# Milestone: [Name]

**Milestone ID:** M#  
**Timeline:** [Dates]  
**Owner:** [Person]  
**Status:** Not Started | In Progress | Complete

---

## 📋 Scope

**Objective:** [What are we building?]

**Deliverables:**
- [ ] [Deliverable 1]
- [ ] [Deliverable 2]

**Success Criteria:**
- [Criterion 1]
- [Criterion 2]

---

## 🔗 Dependencies

**Milestone Dependencies:**
- M1 must complete before this starts (provides API contract)
- M2 must be in progress (shared database schema)

**Architecture Decisions:**
- ADR-001: [Decision name] - See `docs/DECISIONS.md#ADR-001`
- ADR-003: [Decision name] - See `docs/DECISIONS.md#ADR-003`

---

## ✅ Tasks

- [ ] [Task 1]
- [ ] [Task 2]
- [ ] [Task 3]

---

## 🚨 Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| [Milestone-specific risk] | High | [Action] |
| [Milestone-specific risk] | Medium | [Action] |

---

## 📝 Notes
- [Any additional context]
```

---

## Core Commands

### 1. `worklog start`

**Purpose:** Begin a worklog session (new initiative or resume existing)

**Behavior:**
1. Check if in initiatives folder, if not navigate to `/Users/yvizcaya/Documents/fujitsu/initiatives`
2. Prompt: "Would you like to [N]ew initiative or [R]esume existing?"
3. **If New (N):**
   - Run `worklog init` workflow
4. **If Resume (R):**
   - Run `worklog list` to show initiatives
   - Prompt: "Select initiative by number or name:"
   - Set as active initiative
   - Load `.claude.md` context
   - Load `planning/ROADMAP.md` for milestone overview
   - Show recent activity summary
5. Prompt: "Start new session? (y/n)"
6. **If yes:**
   - Prompt for session name/description (optionally link to milestone: "Which milestone? (M1/M2/etc)"
   - Create `sessions/YYYY-MM-DD_session-name/` folder
   - Create `notes.md` with template
   - Update `sessions.log`
   - Increment `sessionCount` in `metadata.json`

**Output:**
```
✓ Loaded initiative: API Redesign
✓ Roadmap: 4 milestones (M1, M2, M3, M4)
✓ Session started: 2024-01-20_m1-endpoint-design

Context loaded. Ready to work on M1!
```

---

### 2. `worklog init`

**Purpose:** Create a new initiative

**Behavior:**
1. Prompt: "Initiative name (kebab-case):" 
   - Validate: lowercase, hyphens only, no spaces
   - Suggest if input has spaces/caps
2. Prompt: "Display name (human-readable):"
3. Prompt: "Brief description:"
4. Prompt: "Primary goal:"
5. Prompt: "Owner name:" (default: yvizcaya)
6. Prompt: "Tags (comma-separated):"
7. Prompt: "Number of milestones:" (optional, can add later)
8. Create folder structure:
   - Root: `initiatives/[name]/`
   - Subfolders: `.worklog/`, `sessions/`, `planning/milestones/`, `docs/`, `artifacts/`
9. Generate `.claude.md` with provided details
10. Generate `README.md` with overview
11. Generate `docs/DECISIONS.md` with header template
12. Generate `planning/ROADMAP.md` with milestone placeholders (if count provided)
13. Create `metadata.json` with:
    - Provided fields
    - `status`: "active"
    - `phase`: "planning"
    - `created`: current timestamp
    - `sessionCount`: 0
    - `milestones`: [] (or populated if count provided)
14. Create empty `sessions.log`
15. Confirm: "Initiative created! Start first session? (y/n)"

**Output:**
```
✓ Created initiative: api-redesign
✓ Folder structure initialized
✓ docs/DECISIONS.md created (ready for ADRs)
✓ planning/ROADMAP.md created (ready for milestones)
✓ Context files generated

Initiative ready! Start first session? (y/n)
```

---

### 3. `worklog list`

**Purpose:** Display all initiatives with status

**Behavior:**
1. Scan `/Users/yvizcaya/Documents/fujitsu/initiatives/` for subdirectories
2. Read each `metadata.json`
3. Display formatted table:

**Output:**
```
📊 Initiatives:

Initiative           Status      Phase      Last Session  Sessions
─────────────────────────────────────────────────────────────────────
api-redesign         Active      Execution  2024-01-20    12
database-migration   Paused      Planning   2024-01-15    5
security-audit       Completed   Complete   2024-01-10    8

Current: api-redesign ✓

Select initiative number to view details, or press Enter to continue.
```

4. If user selects number:
   - Show full initiative details from `.claude.md`
   - Show last 3 sessions from `sessions.log`
   - Offer to resume: "Resume this initiative? (y/n)"

---

### 4. `worklog update`

**Purpose:** Update `.claude.md` context manually

**Behavior:**
1. Check active initiative is set
2. Load current `.claude.md` content
3. Interactive prompts:

```
🔄 Updating context for: api-redesign

1. Status changed?
   Current: Active (Execution)
   New: [Active|Paused|Blocked|Completed] (press Enter to keep) > 
   Phase: [Planning|Execution|Review|Complete] (press Enter to keep) > 

2. Progress summary:
   What was accomplished recently?
   > Completed REST endpoint design, started implementation

3. New blockers?
   Add blocker? (y/n) > y
   Blocker: > Waiting for database schema approval
   Add another? (y/n) > n

4. New questions?
   Add question? (y/n) > n

5. Next steps:
   Action item: > Implement authentication middleware
   Add another? (y/n) > n

6. Latest session summary:
   Session date: 2024-01-20
   Summary: > Designed 5 REST endpoints, created OpenAPI spec
```

4. Update `.claude.md` sections:
   - Status/Phase (if changed)
   - Recent Activity (prepend new progress)
   - Current Blockers (add new items)
   - Open Questions (add new items)
   - Next Steps (replace list)
   - Latest Session (update)
   - Last Updated timestamp

5. Update `metadata.json`:
   - `status` (if changed)
   - `phase` (if changed)
   - `lastUpdated` timestamp

6. Show preview:
```
✓ Context updated!

Preview changes? (y/n) > y
[Shows diff of .claude.md changes]

Save? (y/n) > y
✓ .claude.md saved
✓ metadata.json updated
```

---

## Session Workflow (AI Behavior)

### At Session Start:
1. Read `.claude.md` for full context
2. Display brief summary:
   - Initiative name & goal
   - Current status & phase
   - Recent progress
   - Current blockers
3. Ask: "What's the goal for this session?"
4. Keep context in memory throughout session

### During Session:
1. Save artifacts to appropriate folders:
   - Code → `artifacts/code/`
   - Docs → `docs/`
   - Plans → `planning/`
2. Take mental notes of:
   - Key decisions made
   - Progress achieved
   - New blockers/questions
3. Organize files using naming conventions

### At Session End:
1. Create session summary in `sessions/YYYY-MM-DD_name/notes.md`:
```markdown
# Session: [Name]

**Date:** YYYY-MM-DD
**Duration:** [HH:MM]
**Milestone:** M# (if applicable)
**Goal:** [Session goal]

## What Was Done
- [Accomplishment 1]
- [Accomplishment 2]

## Architecture Decisions Made
- ADR-XXX: [Decision name] - See docs/DECISIONS.md#ADR-XXX
- [Any decision updates]

## Artifacts Created
- `path/to/file1.ext`
- `path/to/file2.ext`

## Milestone Progress
- [Task completed in M#]
- [Blockers encountered]

## Next Session
- [ ] [Task 1]
- [ ] [Task 2]

## Blockers/Questions
- [Any new blockers—escalate to .claude.md if persistent]
```

2. Append to `.worklog/sessions.log`:
```
2024-01-20T14:00:00Z | 2024-01-20_m1-endpoint-design | M1: Designed REST endpoints
```

3. Prompt: "Update initiative context or milestone plan? (y/n/later)"
   - If yes: Update `.claude.md` and/or `planning/milestones/m#-name.md`
   - If later: Remind next session start

---

## 🛡️ Railguards: File Creation & Modification Rules

**Purpose:** Maintain initiative workspace integrity through strict file organization rules.

**Full Reference:** See `RAILGUARDS.md` for detailed validation rules, permission matrix, and enforcement guidelines.

### Quick Validation Checklist

Before creating/modifying any file:

- [ ] **Location Check:** Right folder for this file type?
- [ ] **Type Check:** File extension allowed in this folder?
- [ ] **Naming Check:** Follows kebab-case conventions?
- [ ] **Format Check:** Dates in YYYY-MM-DD format?
- [ ] **Sequence Check:** Milestone/ADR numbering sequential?
- [ ] **Immutability Check:** Not modifying append-only history?

### Key Restrictions

**Initiative Root:**
- ✅ ONLY: `.claude.md`, `README.md`
- ❌ NEVER: arbitrary files

**sessions/**
- ✅ ONLY: `notes.md`, `*.txt`, `*.log`
- ❌ NEVER: code, data files
- ⛔ IMMUTABLE: never edit past sessions

**planning/**
- ✅ ONLY: `ROADMAP.md`, `m#-kebab-case.md`
- ❌ NEVER: arbitrary markdown files
- ⚠️ SEQUENTIAL: m1, m2, m3 (warn if gaps)

**docs/**
- ✅ ONLY: `DECISIONS.md`, `*.md`, diagrams
- ❌ NEVER: code, scripts
- ⛔ ADR IMMUTABLE: append only, never edit existing

**artifacts/**
- ✅ ANY: code, data, scripts, outputs
- 💡 SUGGEST: organize in subfolders

**.worklog/**
- ⛔ PROTECTED: modify only via worklog commands
- ⛔ READ-ONLY: `name`, `created`, `sessionCount`

### Rejection Pattern

When rejecting invalid operations:

```
❌ [Clear reason]

💡 Did you mean:
   [Option 1 with full path]
   [Option 2 with full path]

Select option or cancel?
```

### Validation Examples

**Invalid Session Name:**
```
❌ '2024-1-20_Session Notes' is invalid
💡 Corrected: 2024-01-20_session-notes
Accept? (y/n)
```

**Code in Wrong Folder:**
```
❌ Cannot create 'script.py' in sessions/
💡 Suggested: artifacts/scripts/script.py
Move? (y/n)
```

**Milestone Sequence Gap:**
```
⚠️ Creating m3 but only m1 exists. Missing m2.
Continue? (y/n)
```

---

## Best Practices

### For AI:
- **Read first:** `.claude.md` → `planning/ROADMAP.md` → relevant milestone plan
- **Validate always:** Check railguards before creating files (see `RAILGUARDS.md`)
- **Reject gracefully:** Provide helpful alternatives when restrictions violated
- **Respect immutability:** Never edit past sessions or existing ADRs
- **Enforce structure:** Only create files in allowed locations with correct naming
- **Add ADRs properly:** Append to `docs/DECISIONS.md`, never create separate files
- **Link correctly:** From milestones to decisions: "See `docs/DECISIONS.md#ADR-XXX`"
- **Update consistently:** Session notes at end of every session
- **Escalate blockers:** To `.claude.md` (not just milestone notes)
- **Name correctly:** kebab-case, ISO dates, sequential numbering

### For Users:
- Run `worklog update` weekly or after major progress
- Keep blockers list current in `.claude.md`
- Archive completed initiatives
- Use descriptive session names
- Link milestone plans to architecture decisions

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `worklog start` | Begin working (new or resume), load milestones |
| `worklog init` | Create new initiative with docs/DECISIONS.md & planning/ROADMAP.md |
| `worklog list` | View all initiatives with milestone counts |
| `worklog update` | Update context manually |
| `worklog milestone` | Create/update individual milestone plan |
| `worklog decision` | Add/update architecture decision (ADR) |

---

*Worklog Skill v1.1 - Milestone-based with centralized architecture decisions*

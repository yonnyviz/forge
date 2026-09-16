# 🛡️ Worklog Railguards Reference

## Overview

**Purpose:** Enforce file organization rules to maintain initiative workspace integrity.

**Scope:** All file creation, modification, and deletion operations within initiative folders.

---

## 🔒 Permission Matrix

| Action | Initiative Root | .worklog/ | sessions/ | planning/ | docs/ | artifacts/ |
|--------|----------------|-----------|-----------|-----------|-------|------------|
| Create .md | ⚠️ Only `.claude.md`, `README.md` | ❌ Never | ✅ `notes.md` only | ✅ `ROADMAP.md`, `m#-*.md` | ✅ `DECISIONS.md`, `*.md` | ✅ Any |
| Create code | ❌ Never | ❌ Never | ❌ Never | ❌ Never | ❌ Never | ✅ Any |
| Create data | ❌ Never | ❌ Never | ❌ Never | ❌ Never | ❌ Never | ✅ Any |
| Create images | ❌ Never | ❌ Never | ❌ Never | ❌ Never | ✅ Diagrams only | ✅ Any |
| Edit existing | ⚠️ Controlled | ⚠️ Metadata only | ❌ Read-only | ✅ Yes | ✅ Append ADRs | ✅ Yes |
| Delete | ❌ Never | ❌ Never | ❌ Never | ⚠️ With confirmation | ⚠️ With confirmation | ✅ Yes |

**Legend:**
- ✅ Allowed
- ❌ Forbidden (reject with suggestion)
- ⚠️ Restricted (specific rules apply)

---

## 📁 Folder-Specific Rules

### Initiative Root (`initiatives/[name]/`)

**ALLOWED:**
- `.claude.md` (AI context file)
- `README.md` (human-readable overview)
- Subdirectories: `.worklog/`, `sessions/`, `planning/`, `docs/`, `artifacts/`

**FORBIDDEN:**
- Any other files at root level
- Arbitrary markdown, code, data, or config files

**Rejection Example:**
```
❌ Cannot create 'notes.md' at initiative root.

💡 Did you mean:
   sessions/2024-01-20_session-name/notes.md (session notes)
   docs/notes.md (documentation notes)
   artifacts/notes.md (reference artifact)
```

---

### `.worklog/` (Machine Metadata)

**ALLOWED:**
- `metadata.json` (initiative tracking data)
- `sessions.log` (session history index)

**MODIFICATION RULES:**
- `metadata.json.name`: ❌ READ-ONLY after creation
- `metadata.json.created`: ❌ READ-ONLY after creation
- `metadata.json.sessionCount`: ⚠️ AUTO-INCREMENT only (via worklog commands)
- `metadata.json.status`: ✅ Can update
- `metadata.json.phase`: ✅ Can update
- `metadata.json.lastSession`: ⚠️ AUTO-UPDATE only
- `metadata.json.lastUpdated`: ⚠️ AUTO-UPDATE only
- `sessions.log`: ⚠️ APPEND-ONLY (never delete entries)

**FORBIDDEN:**
- Creating new files in `.worklog/`
- Manually editing timestamps or counters
- Deleting or truncating `sessions.log`

---

### `sessions/` (Work Session Logs)

**STRUCTURE:**
```
sessions/
└── YYYY-MM-DD_kebab-case-description/
    ├── notes.md          ✅ REQUIRED
    ├── scratch.txt       ✅ ALLOWED
    └── references.log    ✅ ALLOWED
```

**NAMING RULES:**
- Folder format: `YYYY-MM-DD_kebab-case-description`
- Date must be ISO 8601 format: `YYYY-MM-DD`
- Description must be kebab-case (lowercase, hyphens only)
- ❌ No spaces, underscores, or capital letters

**ALLOWED FILE TYPES:**
- `.md` (notes, summaries)
- `.txt` (scratch notes, temporary text)
- `.log` (command logs, references)

**FORBIDDEN FILE TYPES:**
- Code files (`.py`, `.js`, `.java`, etc.) → Use `artifacts/code/`
- Data files (`.csv`, `.json`, `.xml`, etc.) → Use `artifacts/data/`
- Binaries, executables, archives
- Configuration files → Use `artifacts/config/`

**IMMUTABILITY:**
- ❌ **NEVER** edit past session notes (read-only after creation)
- ❌ **NEVER** delete session folders
- ✅ **ALWAYS** create new sessions for new work

**Validation Example:**
```
❌ Session name '2024-1-20_Session Notes' is invalid.

💡 Correct format: 2024-01-20_session-notes
   - Date: 2024-01-20 (ISO format)
   - Description: session-notes (kebab-case)

Auto-correct? (y/n)
```

---

### `planning/` (Roadmap & Milestones)

**STRUCTURE:**
```
planning/
├── ROADMAP.md         ✅ REQUIRED (milestone index)
└── milestones/
    ├── m1-name.md     ✅ ALLOWED
    ├── m2-name.md     ✅ ALLOWED
    └── m10-name.md    ✅ ALLOWED (auto-sequences)
```

**ROADMAP.md:**
- ✅ Single file at `planning/ROADMAP.md`
- ❌ No alternative names (`roadmap.md`, `PLAN.md`, etc.)
- ✅ Contains milestone overview, dependencies, timeline

**MILESTONE NAMING:**
- Format: `m[1-9][0-9]*-kebab-case.md`
- Valid: `m1-setup.md`, `m2-api-design.md`, `m10-deployment.md`
- Invalid: `milestone-1.md`, `M1-setup.md`, `1-setup.md`
- ❌ No spaces, capitals, or arbitrary names

**MILESTONE SEQUENCING:**
- ✅ Sequential numbering: m1, m2, m3, ...
- ⚠️ Warn if gaps detected: m1, m3 (missing m2)
- ⚠️ Warn if out-of-order creation

**ALLOWED FILE TYPES:**
- `.md` only (markdown documentation)

**FORBIDDEN FILE TYPES:**
- Code, scripts, data files → Use `artifacts/`
- Images → Use `docs/` for diagrams
- Non-markdown documents

**Validation Example:**
```
⚠️ Creating m3-implementation.md but only m1-setup.md exists.
   Missing m2. Create milestones in sequence?

Continue anyway? (y/n)
```

---

### `docs/` (Documentation & Decisions)

**STRUCTURE:**
```
docs/
├── DECISIONS.md       ✅ REQUIRED (ADR index)
├── architecture.md    ✅ ALLOWED
├── api-spec.md        ✅ ALLOWED
└── diagrams/
    ├── system.png     ✅ ALLOWED
    └── flow.svg       ✅ ALLOWED
```

**DECISIONS.md (Architecture Decision Records):**
- ✅ Single file at `docs/DECISIONS.md`
- ❌ Never create separate ADR files (`adr-001.md`, etc.)
- ✅ All ADRs live in this single document

**ADR FORMAT:**
- Numbering: `ADR-[001-999]` (zero-padded to 3 digits)
- Valid: `ADR-001`, `ADR-042`, `ADR-100`
- Invalid: `ADR-1`, `ADR01`, `adr-001`
- ⚠️ Auto-increment from last ADR number

**ADR IMMUTABILITY:**
- ❌ **NEVER** edit existing ADRs
- ✅ **ALWAYS** append new ADRs to the end
- ✅ **SUPERSEDE** outdated decisions with new ADRs
- ✅ Update status field: `Superseded by ADR-XXX`

**ALLOWED FILE TYPES:**
- `.md` (markdown documentation)
- `.pdf` (external references, specs)
- `.png`, `.svg`, `.jpg` (diagrams, architecture visuals)

**FORBIDDEN FILE TYPES:**
- Code files → Use `artifacts/code/`
- Executable scripts → Use `artifacts/scripts/`
- Data files → Use `artifacts/data/`

**Validation Example:**
```
ℹ️ Adding ADR to docs/DECISIONS.md
   Last ADR: ADR-005
   New ADR: ADR-006

✓ ADR-006 appended successfully.
```

---

### `artifacts/` (Code, Scripts, Data, Deliverables)

**STRUCTURE:**
```
artifacts/
├── code/              💡 RECOMMENDED
│   └── *.py, *.js
├── scripts/           💡 RECOMMENDED
│   └── *.sh, *.bat
├── data/              💡 RECOMMENDED
│   └── *.csv, *.json
├── config/            💡 RECOMMENDED
│   └── *.yaml, *.toml
└── outputs/           💡 RECOMMENDED
    └── *.log, *.txt
```

**ALLOWED:**
- ✅ **ANY file type** (most permissive folder)
- ✅ Code in any language
- ✅ Binaries, executables, archives
- ✅ Data files, databases, caches
- ✅ Generated outputs, reports, logs

**RECOMMENDATIONS:**
- 💡 Organize by type: `code/`, `scripts/`, `data/`, `outputs/`
- 💡 Avoid dumping everything at root of `artifacts/`
- 💡 Use descriptive subfolder names

**SUBFOLDER AUTO-SUGGESTION:**
```
ℹ️ Creating 'process_data.py' in artifacts/

💡 Suggestion: artifacts/scripts/process_data.py
   Keep code organized by type?

Use suggestion? (y/n)
```

---

## 🔤 Naming Conventions

### Kebab-Case Enforcement

**Rule:** All user-generated names must use kebab-case.

**Valid:**
- `api-redesign`
- `database-migration`
- `2024-01-20_session-notes`
- `m1-setup-infrastructure`

**Invalid:**
- `API_Redesign` (capitals, underscores)
- `database migration` (spaces)
- `session_notes` (underscores)
- `Milestone1Setup` (camelCase)

**Auto-Correction:**
```python
def to_kebab_case(name: str) -> str:
    return name.lower()
               .replace(' ', '-')
               .replace('_', '-')
               .strip('-')
```

**Prompt Example:**
```
⚠️ Name 'API Redesign' contains invalid characters.

💡 Suggested: api-redesign

Accept? (y/n)
```

---

### Date Format Enforcement

**Rule:** All dates must be ISO 8601 format: `YYYY-MM-DD`

**Valid:**
- `2024-01-20`
- `2024-12-31`

**Invalid:**
- `2024-1-20` (missing zero-padding)
- `01-20-2024` (US format)
- `20/01/2024` (European format)
- `Jan 20 2024` (text format)

**Validation:**
```python
import re
from datetime import datetime

def validate_date(date_str: str) -> bool:
    pattern = r'^\d{4}-\d{2}-\d{2}$'
    if not re.match(pattern, date_str):
        return False
    try:
        datetime.strptime(date_str, '%Y-%m-%d')
        return True
    except ValueError:
        return False
```

---

### Sequential Numbering

**Milestones:** `m1`, `m2`, `m3`, ..., `m99`
**ADRs:** `ADR-001`, `ADR-002`, ..., `ADR-999`

**Validation:**
```python
def validate_milestone_sequence(new_num: int, existing: list[int]) -> tuple[bool, str]:
    if new_num in existing:
        return False, f"m{new_num} already exists"
    
    max_existing = max(existing) if existing else 0
    if new_num > max_existing + 1:
        return False, f"Gap detected. Create m{max_existing + 1} first?"
    
    return True, "OK"
```

---

## ⚠️ Pre-Flight Validation Checks

### Check 1: Location Validation

```python
def validate_location(target_path: str) -> tuple[bool, str]:
    """Ensure file is created in appropriate folder."""
    
    parts = Path(target_path).parts
    initiative_root = Path('initiatives') / parts[1]
    relative_path = Path(target_path).relative_to(initiative_root)
    
    # Root level check
    if len(relative_path.parts) == 1:
        allowed_root = ['.claude.md', 'README.md']
        if relative_path.name not in allowed_root:
            return False, "Root level files restricted. Use docs/, artifacts/, planning/, or sessions/"
    
    return True, "OK"
```

### Check 2: File Type Validation

```python
def validate_file_type(target_path: str) -> tuple[bool, str]:
    """Ensure file type matches folder purpose."""
    
    folder = Path(target_path).parent.name
    extension = Path(target_path).suffix
    
    rules = {
        'sessions': ['.md', '.txt', '.log'],
        'planning': ['.md'],
        'docs': ['.md', '.pdf', '.png', '.svg', '.jpg'],
        'artifacts': ['*']  # Allow all
    }
    
    if folder in rules and rules[folder] != ['*']:
        if extension not in rules[folder]:
            return False, f"{extension} files not allowed in {folder}/. Use artifacts/ instead."
    
    return True, "OK"
```

### Check 3: Naming Validation

```python
def validate_session_name(name: str) -> tuple[bool, str]:
    """Validate session folder name format."""
    
    pattern = r'^\d{4}-\d{2}-\d{2}_[a-z0-9-]+$'
    if not re.match(pattern, name):
        # Attempt auto-correction
        corrected = auto_correct_session_name(name)
        return False, f"Invalid format. Did you mean: {corrected}?"
    
    return True, "OK"

def validate_milestone_name(name: str) -> tuple[bool, str]:
    """Validate milestone filename format."""
    
    pattern = r'^m\d+-[a-z0-9-]+\.md$'
    if not re.match(pattern, name):
        return False, "Format must be: m#-kebab-case.md (e.g., m1-setup.md)"
    
    return True, "OK"
```

### Check 4: Sequence Validation

```python
def validate_milestone_sequence(new_milestone: str, existing_milestones: list[str]) -> tuple[bool, str]:
    """Check milestone numbering sequence."""
    
    new_num = int(re.search(r'm(\d+)-', new_milestone).group(1))
    existing_nums = [int(re.search(r'm(\d+)-', m).group(1)) for m in existing_milestones]
    
    if not existing_nums:
        return True, "OK" if new_num == 1 else "First milestone should be m1"
    
    max_existing = max(existing_nums)
    if new_num in existing_nums:
        return False, f"m{new_num} already exists"
    
    if new_num > max_existing + 1:
        return False, f"Gap detected. Next sequential is m{max_existing + 1}"
    
    return True, "OK"

def validate_adr_sequence(docs_content: str) -> int:
    """Get next ADR number from DECISIONS.md."""
    
    adr_pattern = r'ADR-(\d{3})'
    matches = re.findall(adr_pattern, docs_content)
    
    if not matches:
        return 1
    
    max_adr = max(int(m) for m in matches)
    return max_adr + 1
```

---

## 🚫 Immutability Rules

### Append-Only History

**PRINCIPLE:** Past work is historical record and must not be altered.

**RULES:**

1. **Session Notes:**
   - ✅ Read past sessions for context
   - ❌ Never edit `sessions/YYYY-MM-DD_*/notes.md`
   - ❌ Never delete session folders
   - 💡 If correction needed, add note to current session

2. **Sessions Log:**
   - ✅ Append new sessions to `.worklog/sessions.log`
   - ❌ Never delete entries
   - ❌ Never modify timestamps or descriptions

3. **Architecture Decisions:**
   - ✅ Append new ADRs to `docs/DECISIONS.md`
   - ❌ Never edit ADR content (except status field)
   - ✅ Supersede with new ADR if decision changes
   - ✅ Update old ADR status: `Status: Superseded by ADR-XXX`

**Status Field Updates (ALLOWED):**
```markdown
## ADR-003: Use PostgreSQL for Data Storage

**Date:** 2024-01-15
**Status:** Superseded by ADR-010  ⬅️ THIS IS OK TO UPDATE
**Author:** yvizcaya

[Rest of ADR content is IMMUTABLE]
```

### Metadata Protection

**READ-ONLY FIELDS:**
```json
{
  "name": "⛔ NEVER CHANGE (folder rename breaks references)",
  "created": "⛔ NEVER CHANGE (historical record)",
  "owner": "⛔ NEVER CHANGE (credit preservation)"
}
```

**AUTO-UPDATE FIELDS:**
```json
{
  "sessionCount": "⚠️ AUTO-INCREMENT via worklog commands",
  "lastSession": "⚠️ AUTO-UPDATE via worklog commands",
  "lastUpdated": "⚠️ AUTO-UPDATE on any change"
}
```

**EDITABLE FIELDS:**
```json
{
  "displayName": "✅ Can update",
  "description": "✅ Can update",
  "goal": "✅ Can update",
  "status": "✅ Can update",
  "phase": "✅ Can update",
  "tags": "✅ Can update",
  "relatedInitiatives": "✅ Can update"
}
```

---

## 💡 Auto-Correction & Suggestions

### Rejection Messages with Solutions

**Pattern:** Always provide actionable alternatives when rejecting operations.

**Template:**
```
❌ [What was rejected and why]

💡 Did you mean:
   [Option 1 with full path]
   [Option 2 with full path]
   [Option 3 with full path]

Select option (1/2/3) or Enter to cancel:
```

**Examples:**

#### Example 1: Code in Session Folder
```
❌ Cannot create 'main.py' in sessions/2024-01-20_coding/
   Code files belong in artifacts/

💡 Suggested location:
   artifacts/code/main.py

Move to suggestion? (y/n)
```

#### Example 2: Root Level File
```
❌ Cannot create 'notes.md' at initiative root.

💡 Did you mean:
   1. sessions/2024-01-20_work-session/notes.md (session notes)
   2. docs/project-notes.md (documentation)
   3. artifacts/notes.md (general notes)

Select option (1/2/3) or Enter to cancel:
```

#### Example 3: Invalid Milestone Name
```
❌ Milestone name 'Milestone 2 - API Design.md' is invalid.

💡 Auto-corrected: m2-api-design.md

Accept? (y/n)
```

#### Example 4: Date Format Error
```
❌ Session date '1-20-2024' is invalid.
   Required format: YYYY-MM-DD (ISO 8601)

💡 Did you mean: 2024-01-20?

Use corrected date? (y/n)
```

---

## 🔍 Validation Workflow

### AI Decision Tree

```
FILE CREATION REQUEST
│
├─ Check Location
│  ├─ Initiative root?
│  │  ├─ .claude.md or README.md? → ✅ ALLOW
│  │  └─ Other file? → ❌ REJECT → Suggest appropriate folder
│  │
│  ├─ .worklog/?
│  │  ├─ metadata.json or sessions.log? → ✅ ALLOW (via command only)
│  │  └─ Other file? → ❌ REJECT
│  │
│  ├─ sessions/?
│  │  ├─ Folder name valid? (YYYY-MM-DD_kebab-case)
│  │  │  ├─ Yes → Check file type
│  │  │  │  ├─ .md/.txt/.log? → ✅ ALLOW
│  │  │  │  └─ Code/data? → ❌ REJECT → Suggest artifacts/
│  │  │  └─ No → ❌ REJECT → Suggest correction
│  │
│  ├─ planning/?
│  │  ├─ ROADMAP.md? → ✅ ALLOW
│  │  ├─ milestones/m#-*.md?
│  │  │  ├─ Name valid? → Check sequence
│  │  │  │  ├─ Sequential? → ✅ ALLOW
│  │  │  │  └─ Gap? → ⚠️ WARN → Allow with confirmation
│  │  │  └─ Invalid name? → ❌ REJECT → Suggest correction
│  │  └─ Other file? → ❌ REJECT
│  │
│  ├─ docs/?
│  │  ├─ DECISIONS.md?
│  │  │  ├─ Adding ADR? → Check sequence → ✅ ALLOW (append)
│  │  │  └─ Editing ADR? → ⚠️ Check if status update only
│  │  ├─ .md/.pdf/image? → ✅ ALLOW
│  │  └─ Code/data? → ❌ REJECT → Suggest artifacts/
│  │
│  └─ artifacts/? → ✅ ALLOW (any file type)
│     └─ 💡 Suggest subfolder organization
│
└─ RESULT
   ├─ ✅ ALLOWED → Proceed
   ├─ ❌ REJECTED → Show error + suggestions
   └─ ⚠️ WARNING → Show warning + ask confirmation
```

---

## 🚀 Enforcement Checklist

Before any file operation, validate:

- [ ] **Location:** Is this the right folder for this file type?
- [ ] **Type:** Is this file type allowed in this folder?
- [ ] **Naming:** Does the name follow kebab-case conventions?
- [ ] **Format:** Are dates in ISO 8601 format?
- [ ] **Sequence:** Is numbering sequential (milestones, ADRs)?
- [ ] **Immutability:** Am I modifying append-only history?
- [ ] **Metadata:** Am I changing read-only fields?

If ANY check fails:
1. ❌ **Reject** the operation
2. 💡 **Suggest** correction or alternative
3. 🤔 **Prompt** for user confirmation (when appropriate)
4. ✅ **Proceed** only after validation passes

---

*Railguards v1.0 - Maintain order, enforce consistency, preserve history*

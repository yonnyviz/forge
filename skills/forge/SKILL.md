---
name: "forge"
description: "Manages forge initiative workspace checkpoints. Auto-detects DoD completion, tracks outputs, and proposes structured updates at session milestones with user confirmation."
---

## Overview

This skill maintains the forge initiative workspace through **unified checkpoints** that update `brief.md`, `memory.md`, and `metadata.json` atomically. It monitors conversation for natural checkpoint triggers and proposes synchronized updates.

**Core principles:**
- 🎯 **Unified checkpoint** — one proposal updates all workspace files atomically
- 🔍 **Propose-then-write** — never silent updates
- ✅ **Auto-detect DoD** — intelligently marks Definition of Done items complete
- 🧷 **Append-only body** — human markdown prose is never rewritten
- 🔀 **Cross-file sync** — DoD ↔ progress ↔ phase ↔ nextAction stay aligned
- 📁 **Auto-track outputs** — catalog deliverables in outputs/ automatically

> **Note:** For workspace file structure and reading protocol, see `AGENTS.md` at the initiative root. Pi loads that context file automatically at startup.

---

## When to Trigger a Workspace Checkpoint

Propose a workspace checkpoint when any of these events occur:

1. **Session end / before exit** — capture final state before closing
2. **Status change** — Active→Paused/Blocked/Completed via `/forge`
3. **Decision finalized** — a design, approach, or constraint is locked in
4. **Open question resolved** — something uncertain becomes clear
5. **Next action changes** — the immediate next step shifts
6. **DoD completion detected** — work signals indicate Definition of Done item is complete
7. **User explicitly requests** — "save progress", "update memory", "checkpoint"

⚠️ **Do NOT checkpoint** for:
- Routine intermediate steps (reading files, running tests, minor edits)
- Exploratory work that hasn't crystallized into decisions
- When the user is actively editing workspace files themselves

---

## Initiative Completion (Hybrid Trigger)

When **all DoD items are ✅ complete**, suggest wrapping up the initiative:

```
🎉 All Definition of Done items complete!

Ready to mark this initiative complete?
  [yes] Mark complete & generate summary
  [not yet] Keep working
  [skip] Remind me later
```

If user selects **yes**:
1. User is prompted for optional completion notes
2. `.forge/completion.md` is auto-generated with:
   - All DoD items (all checked ✅)
   - Deliverables from outputs/
   - Key decisions from memory.md
   - User's completion notes
3. Status → completed, phase → complete
4. User sees: "✓ Initiative completed. Summary saved to .forge/completion.md"

User can also manually trigger completion anytime via `/forge` → "Update initiative status" → "✓ Completed"

---

## Natural Language Trigger Patterns

Monitor conversation for these patterns. When detected with sufficient confidence, propose a memory checkpoint.

### High Confidence (always propose)

**Explicit forge commands:**
- "forge save"
- "forge checkpoint"
- "forge update"
- "forge record"
- "forge capture"
- "forge memory"

When user says "forge" followed by any of these command words, **immediately** propose a memory checkpoint.

**Other explicit commands:**
- "save progress"
- "update memory"
- "checkpoint" / "checkpoint this"
- "record this decision"
- "capture the current state"
- "write this down in memory"

**Session end signals:**
- "I'm done for today" / "done for now"
- "wrapping up" / "that's it for now"
- "I'm logging off" / "logging off"
- "see you tomorrow"
- "exiting" / "bye" / "goodbye"
- User says they're leaving or ending the session

### Medium-High Confidence (propose if contextually appropriate)

**Decision language:**
- "we've decided to..."
- "let's go with..."
- "I'm committing to..."
- "the approach will be..."
- "ruling out [option] because..."
- "that settles it"
- "final decision is..."

**Question resolution:**
- "that answers [question]"
- "figured it out — ..."
- "so the answer is..."
- "no longer blocked on..."
- "we can close that question"
- "turns out [explanation]"

**Next action shift:**
- "next I need to..."
- "the next step is..."
- "tomorrow I'll..."
- "moving on to..."
- "switching focus to..."
- "now let's tackle..."

### Accumulated Signals (propose after 2-3 in one session)

**Progress markers:**
- "finished [subtask]"
- "completed [item]"
- "that's working now"
- "tests pass"
- "[component] is done"
- Successfully creating/editing files in outputs/
- "deployed", "shipped", "merged"

**Uncertainty → clarity:**
- "wait, actually..." (followed by new understanding)
- "never mind, the real issue is..."
- "ah! it's because..."

**Task completion:**
- Successfully fulfilling a user request fully
- Multiple files changed + tests green
- All immediate blockers resolved

**Initiative completion detection:**
- All DoD items are marked complete
- → Automatically suggest: "Ready to mark this initiative complete?"
- User confirms → generate completion summary

---

## Checkpoint Proposal Format

**Structure:**
```
📝 Workspace checkpoint

brief.md (Definition of Done):
  ✅ [Item that's now complete]
     [detection rationale: user quote or observed fact]
  
  NEW ITEM: [new DoD item if requested]

memory.md:
  Next action:
    OLD: [previous next action]
    NEW: [new next action]
  
  Progress:
    + [new progress entry 1]
    + [new progress entry 2]
  
  Decisions:
    + [new decision if any]
      Rationale: [why]
  
  Open questions:
    - RESOLVED: [question that's now answered]
    + [new open question if any]
  
  Blockers:
    + [new blocker if any]

metadata.json:
  status: [active|paused|blocked|completed]
  phase: [planning|execution|review|complete]

📁 New outputs/ content:
  + path/to/artifact.ext

Proceed? [yes/no/edit]
```

**Confirming:**
- If user says "yes" / "y" / "go ahead" / "looks good" → apply immediately
- If user edits inline → incorporate changes, show revised preview, confirm again
- If user says "no" / "cancel" → abort without writing

---

## DoD Auto-Detection

Mark a Definition of Done item complete when any of these are observed:

**Direct user confirmation:**
- "that DoD item is done"
- "[DoD item] is complete"
- "checked off [item]"

**Work evidence:**
- Tests pass that validate the DoD item
- User demonstrates the DoD criterion working
- File artifacts match the DoD description

**User statement patterns:**
- "authentication is working" → DoD item "Authentication flow implemented"
- "CI passes on all platforms" → DoD item "Multi-platform CI"
- "docs are published" → DoD item "Documentation complete"

**When uncertain:**
- Propose marking it complete but include the detection rationale
- Let user reject if it's a false positive
- If rejected, learn that pattern and reduce confidence for similar cases

---

## outputs/ Artifact Tracking

Automatically detect new or changed files in `outputs/`:

1. Before checkpoint, scan `outputs/` recursively
2. Compare against previous checkpoint (stored in memory or metadata)
3. Any new or modified files → include in "📁 New outputs/ content" preview
4. Update metadata.json with the latest list

**Ignore patterns:**
- `.DS_Store`, `Thumbs.db`, temp files
- Directories without files
- Hidden files (unless explicitly created by user)

---

## Cross-File Synchronization Rules

| Trigger | Automatic Syncs |
|---|---|
| DoD item marked complete | Progress += completion note |
| All DoD complete + phase = execution | status → completed, phase → complete |
| New blocker added | status → blocked (unless user overrides) |
| Blocker resolved | status → active (unless user overrides) |
| Next action changes | metadata.agent.nextAction = new value |
| Decision added | memory.decisions += new decision |
| Open question resolved | Remove from memory.openQuestions |

---

## Brief vs Memory Boundaries

| File | What Belongs | What Does NOT |
|---|---|---|
| `brief.md` | Outcome, scope, DoD, constraints, affected paths | Progress, next steps, session notes |
| `memory.md` | Status, decisions, progress, blockers, open questions, next action | Original intent, DoD, scope rules |

**When unsure:** Put it in `memory.md` — brief is stable intent, memory is live state.

---

## Conflict Detection & Safety

Before writing, check for concurrent edits:

1. **Re-read all workspace files** just before writing (`brief.md`, `memory.md`, `metadata.json`)
2. If any file changed since the preview was generated:
   - Recompute deltas against the *new* current state
   - Show updated preview: "⚠️ Workspace changed since preview. Updated proposal:"
   - Wait for fresh confirmation
3. If the user is actively editing any file (detected via timestamp within last 60s):
   - Warn: "⚠️ You recently edited [file]. Proceed with checkpoint?"
   - Require explicit approval

---

## Edge Cases & Guardrails

| Scenario | Behavior |
|---|---|
| Workspace file missing or malformed | Warn, offer to recreate with forge defaults (ask first) |
| User manually edited forge-context JSON | Honor their changes; only update fields that differ |
| Empty nextAction proposed | Reject — nextAction must always have content |
| Duplicate decision title | Merge or append sequence number |
| DoD false positive (user rejects) | Learn: reduce confidence for similar patterns (future) |
| New file in outputs/ deleted before checkpoint | Ignore, don't list in preview |

---

## Example Interaction

**Agent (checkpoint triggered at session end):**
```
📝 Workspace checkpoint

brief.md (Definition of Done):
  ✅ Authentication flow is implemented and secure
     [detected: "auth flow is done", "JWT validation working"]

memory.md:
  Next action:
    OLD: Implement authentication flow
    NEW: Write tests for authentication middleware
  
  Progress:
    + Implemented JWT token generation and validation
    + Added user session store with Redis backend
    + Secured all protected routes with auth middleware
  
  Decisions:
    + Use JWT tokens instead of session cookies
      Rationale: Better support for mobile clients and microservices

📁 New outputs/ content:
  + auth/jwt.ts
  + auth/middleware.ts

Proceed?
```

**User:** yes

**Agent:**
```
✓ Workspace checkpoint applied
  • brief.md updated (1 DoD marked complete)
  • memory.md updated (progress, next action, decision)
  • metadata.json updated (agent.nextAction)
```

---

## Integration with `/forge` Command

The skill complements but does not replace `/forge`:

- **Skill:** Natural checkpoint proposals during work
- **`/forge`:** Explicit status changes, session management, initiative switching

When user runs `/forge` → update status → the skill should **not** interfere. Wait until the user returns to work, then resume normal checkpoint monitoring.

---

## Summary

✅ **Do:**
- Monitor conversation for checkpoint triggers
- Propose unified previews before writing
- Auto-detect DoD completion with rationale
- Track outputs/ artifacts
- Keep brief vs memory boundaries clear

❌ **Don't:**
- Write silently without confirmation
- Checkpoint routine intermediate steps
- Rewrite user prose in markdown bodies
- Propose checkpoints during active `/forge` UI flows
- Override user edits without conflict warning

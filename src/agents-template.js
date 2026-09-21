/**
 * AGENTS.md template generator
 * Generates the agent context file with current initiative state
 */

/**
 * Generate AGENTS.md content from metadata
 */
export function generateAgentsMd(metadata) {
  const activeBlockers = metadata.blockers?.filter((b) => b.active).length || 0;
  const openQuestions = metadata.questions?.filter((q) => q.open).length || 0;
  const completedDoD = metadata.definitionOfDone?.filter((d) => d.completed).length || 0;
  const totalDoD = metadata.definitionOfDone?.length || 0;

  return `# Forge Initiative Workspace

**Initiative:** ${metadata.displayName}  
**Stage:** ${metadata.stage} · **Next:** ${metadata.nextAction}

---

## 📂 Workspace Structure

\`\`\`
initiative/
├── .forge/
│   └── metadata.json    # ALL workspace data (read this first)
├── AGENTS.md            # This file (how to work with the workspace)
└── outputs/             # Deliverables and artifacts
\`\`\`

---

## 🔁 Working Protocol

### 1️⃣ **Read First**

\`\`\`bash
# Load the entire workspace state
cat .forge/metadata.json
\`\`\`

**Key fields to check:**
- \`outcome\` — what success looks like
- \`stage\` — current lifecycle phase
- \`nextAction\` — immediate next step
- \`definitionOfDone[]\` — completion criteria
- \`constraints[]\` — limitations and requirements
- \`blockers[]\` — current obstacles (active: true)
- \`questions[]\` — open questions (open: true)
- \`decisions[]\` — locked-in choices (read rationale)
- \`progress[]\` — chronological work log (most recent first)

---

### 2️⃣ **Update as You Work**

All updates go directly to \`.forge/metadata.json\`. Use these patterns:

#### ✅ **Log Progress**

\`\`\`javascript
// Add to progress[] array (prepend for reverse chronological)
{
  "timestamp": new Date().toISOString(),
  "entry": "Implemented user password hashing with bcrypt"
}
\`\`\`

#### 🔒 **Record a Decision**

\`\`\`javascript
// Add to decisions[] array
{
  "timestamp": new Date().toISOString(),
  "decision": "Use bcrypt with cost factor 12 for password hashing",
  "rationale": "Balance between security and performance. Cost 12 takes ~250ms on current hardware.",
  "alternatives": [
    "argon2 (rejected: not available in standard Node.js)"
  ]
}
\`\`\`

#### 🚧 **Add a Blocker**

\`\`\`javascript
// Add to blockers[] array
{
  "added": new Date().toISOString(),
  "blocker": "Waiting for security team to approve token expiry policy",
  "active": true
}

// Update stage if blocked
"stage": "blocked"
\`\`\`

#### 🔓 **Resolve a Blocker**

\`\`\`javascript
// Find the blocker and update it
{
  "added": "2024-01-15T14:30:00Z",
  "blocker": "Waiting for security team to approve token expiry policy",
  "active": false,
  "resolved": new Date().toISOString(),
  "resolution": "Approved: 15min access, 7d refresh tokens"
}

// Update stage back to building
"stage": "building"
\`\`\`

#### ❓ **Ask a Question**

\`\`\`javascript
// Add to questions[] array
{
  "added": new Date().toISOString(),
  "question": "Should we implement rate limiting on login attempts?",
  "open": true
}
\`\`\`

#### 💡 **Answer a Question**

\`\`\`javascript
// Find the question and update it
{
  "added": "2024-01-15T14:30:00Z",
  "question": "Should we implement rate limiting on login attempts?",
  "open": false,
  "answered": new Date().toISOString(),
  "answer": "Yes - 5 attempts per 15 minutes per IP address"
}
\`\`\`

#### 📦 **Track an Output**

\`\`\`javascript
// Add to outputs[] array when you create a deliverable
{
  "path": "auth/password-hasher.ts",
  "added": new Date().toISOString(),
  "description": "Bcrypt password hashing utilities"
}
\`\`\`

#### ✓ **Complete a DoD Item**

\`\`\`javascript
// Find in definitionOfDone[] and update
{
  "criterion": "Integration tests passing with >80% coverage",
  "completed": true,
  "completedAt": new Date().toISOString()
}
\`\`\`

#### 🎯 **Update Next Action**

\`\`\`javascript
// Simply update the top-level field
"nextAction": "Write tests for password reset flow"
\`\`\`

---

### 3️⃣ **Checkpoint (Save State)**

**Auto-checkpoint triggers:**
- Session end ("done for today", "wrapping up")
- Decision finalized
- Blocker added/resolved
- Next action changes
- User says "forge checkpoint" or "save progress"

**Manual checkpoint:**
\`\`\`javascript
// Update the top-level timestamp
"updated": new Date().toISOString()
\`\`\`

**No confirmation required** — just write the file atomically.

---

### 4️⃣ **Complete the Initiative**

When all \`definitionOfDone[]\` items have \`completed: true\`:

\`\`\`javascript
// Set stage to done
"stage": "done"

// Add completion summary
"completion": {
  "completedAt": new Date().toISOString(),
  "summary": "Secure JWT authentication system with session management. All core features implemented and tested.",
  "keyDecisions": [
    "JWT tokens with 15min expiry",
    "Redis-backed refresh tokens (7d)",
    "bcrypt cost factor 12 for passwords"
  ],
  "artifacts": [
    "auth/jwt.ts",
    "auth/middleware.ts",
    "auth/session-store.ts",
    "docs/AUTH_SETUP.md"
  ]
}
\`\`\`

---

## 🎯 Quick Reference: Stage Transitions

| Current Stage | Trigger | Next Stage |
|---|---|---|
| \`planning\` | Start building | \`building\` |
| \`building\` | Blocker added | \`blocked\` |
| \`blocked\` | Blocker resolved | \`building\` |
| \`building\` | Ready for review | \`review\` |
| \`review\` | Changes needed | \`building\` |
| \`review\` | All DoD complete | \`done\` |
| Any | On hold | \`paused\` |
| \`paused\` | Resume work | \`building\` or \`review\` |

---

## 🚫 What NOT to Do

❌ **Don't create separate session notes files** — use \`progress[]\` array  
❌ **Don't duplicate data** — metadata.json is the single source of truth  
❌ **Don't edit this AGENTS.md file** — it's instructions, not state  
❌ **Don't ask for confirmation before checkpointing** — just write  
❌ **Don't leave arrays unsorted** — newest first for progress/decisions  

---

## 📍 Current State Summary

**Stage:** ${metadata.stage}  
**Next Action:** ${metadata.nextAction}  
**Blockers:** ${activeBlockers} active  
**Open Questions:** ${openQuestions}  
**Definition of Done:** ${completedDoD}/${totalDoD} complete  
**Last Updated:** ${new Date(metadata.updated).toLocaleString()}

${metadata.completion ? `\n---\n\n## 🏁 Completion\n\n**Completed:** ${new Date(metadata.completion.completedAt).toLocaleString()}\n\n**Summary:** ${metadata.completion.summary}\n` : ""}

---

*This workspace follows the Forge two-file pattern: metadata.json (data) + AGENTS.md (protocol).*
`;
}

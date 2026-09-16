# 📋 Worklog - AI Skill for Initiative-based Workflow

> **Organize work by initiatives with persistent context, structured sessions, and AI memory**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.1-blue.svg)](https://github.com/yonnyviz/worklog)

---

## 🎯 **What is Worklog?**

Worklog is an AI skill that helps you manage complex projects (initiatives) with:

- ✅ **Structured work sessions** with persistent AI context
- ✅ **Milestone-based planning** with roadmaps and execution plans
- ✅ **Architecture Decision Records (ADRs)** in a centralized system
- ✅ **Strict file organization** enforced by railguards
- ✅ **Immutable history** that preserves all past work

Perfect for developers, architects, and teams managing multiple long-running projects where context matters.

---

## 🚀 **Quick Start**

### 1. Clone or Install

```bash
# Clone this repo into your AI skills directory
git clone https://github.com/yonnyviz/worklog.git ~/.pi/agent/skills/worklog

# Or copy SKILL.md to your skills folder
```

### 2. Start Your First Initiative

```bash
# Navigate to your initiatives folder (configure path in SKILL.md)
cd ~/Documents/fujitsu/initiatives

# Use AI command (with Claude, Pi, or compatible AI)
worklog init
```

### 3. Begin Working

```bash
worklog start
```

---

## 📁 **Initiative Structure**

Each initiative follows this organized structure:

```
initiatives/
└── [initiative-name]/
    ├── .claude.md              # 🤖 AI context & navigation
    ├── README.md               # 📖 Human-readable overview
    ├── .worklog/
    │   ├── metadata.json       # 📊 Initiative tracking data
    │   └── sessions.log        # 📝 Session history index
    ├── sessions/
    │   └── YYYY-MM-DD_session-name/
    │       └── notes.md        # 📓 Session work notes
    ├── planning/
    │   ├── ROADMAP.md          # 🗺️  Milestone overview
    │   └── milestones/
    │       └── m1-name.md      # 🎯 Execution plans
    ├── docs/
    │   ├── DECISIONS.md        # 🏛️  Architecture Decision Records
    │   └── *.md                # 📚 Documentation
    └── artifacts/
        ├── code/               # 💻 Source code
        ├── scripts/            # 🔧 Automation scripts
        ├── data/               # 📊 Data files
        └── outputs/            # 📦 Generated artifacts
```

---

## 🛡️ **Railguards - File Organization Rules**

Worklog enforces strict rules to maintain order:

### Permission Matrix

| Folder | Allowed Files | Forbidden Files |
|--------|---------------|-----------------|
| **Initiative Root** | `.claude.md`, `README.md` | Everything else |
| **sessions/** | `notes.md`, `*.txt`, `*.log` | Code, data files |
| **planning/** | `ROADMAP.md`, `m#-*.md` | Arbitrary files |
| **docs/** | `DECISIONS.md`, `*.md`, diagrams | Code, scripts |
| **artifacts/** | **Anything** | *(most permissive)* |
| **.worklog/** | `metadata.json`, `sessions.log` | Manual edits |

### Naming Conventions

- ✅ **Sessions:** `YYYY-MM-DD_kebab-case` (e.g., `2024-01-20_api-design`)
- ✅ **Milestones:** `m[1-9][0-9]*-kebab-case.md` (e.g., `m1-setup.md`, `m10-deploy.md`)
- ✅ **ADRs:** `ADR-[001-999]` (e.g., `ADR-001`, `ADR-042`)
- ✅ **Files:** `kebab-case-name.ext` (no spaces, underscores, or capitals)

### Immutability Rules

- ⛔ **Never** edit past session notes (read-only historical record)
- ⛔ **Never** modify existing ADRs (supersede with new ones)
- ⛔ **Never** delete entries from `sessions.log`
- ⛔ **Never** change `metadata.json.name` or `.created` fields

**📖 Full details:** See [`RAILGUARDS.md`](RAILGUARDS.md)

---

## 🎮 **Core Commands**

| Command | Purpose |
|---------|---------|
| `worklog init` | Create a new initiative with folder structure |
| `worklog start` | Begin or resume a work session |
| `worklog list` | View all initiatives with status |
| `worklog update` | Update initiative context (`.claude.md`) |

---

## 💡 **Key Features**

### 1. **Persistent AI Context**

The `.claude.md` file acts as AI memory:
- 📍 Current status and phase
- 📅 Recent activity summary
- 🚧 Active blockers
- ❓ Open questions
- ✅ Next steps

AI reads this file at every session start to maintain context across days, weeks, or months.

### 2. **Milestone-Based Planning**

**ROADMAP.md** provides executive overview:
- Milestone dependencies
- Timeline and deliverables
- Success criteria

**Individual milestone plans** (`m1-setup.md`, `m2-api.md`) contain:
- Scope and objectives
- Task breakdowns
- Risk mitigation
- Links to architecture decisions

### 3. **Architecture Decision Records (ADRs)**

Centralized in `docs/DECISIONS.md`:
- Immutable history of technical choices
- Context, rationale, and consequences
- Sequential numbering (ADR-001, ADR-002, ...)
- Supersede outdated decisions instead of editing

### 4. **Session Tracking**

Every work session creates:
- Time-stamped folder: `sessions/2024-01-20_api-design/`
- Session notes with accomplishments, decisions, and next steps
- Entry in `.worklog/sessions.log`
- Auto-increment `sessionCount` in metadata

### 5. **Validation & Auto-Correction**

When AI attempts invalid operations:

```
❌ Cannot create 'main.py' in sessions/

💡 Suggested: artifacts/code/main.py
Move to suggestion? (y/n)
```

All file creation is validated against railguards before execution.

---

## 📖 **Documentation**

- **[SKILL.md](SKILL.md)** - Complete skill specification with commands, templates, and workflows
- **[RAILGUARDS.md](RAILGUARDS.md)** - Comprehensive file organization rules and validation logic

---

## 🔧 **Configuration**

Edit `SKILL.md` to customize:

**Working Location:**
```markdown
**Working Location:** `/Users/yvizcaya/Documents/fujitsu/initiatives`
```

Change this path to your preferred initiatives directory.

**Folder Names:**
Modify the folder structure template if you need different folder names (though consistency is recommended).

---

## 🎯 **Use Cases**

### Perfect For:

- ✅ **Long-running projects** with multiple work sessions
- ✅ **Complex initiatives** requiring structured planning
- ✅ **Architecture-heavy work** with decision tracking
- ✅ **Multi-phase projects** with milestones and dependencies
- ✅ **Teams** needing consistent file organization
- ✅ **AI-assisted development** requiring persistent context

### Not Ideal For:

- ❌ Quick one-off scripts or experiments
- ❌ Projects without planning phases
- ❌ Simple tasks that don't need session tracking

---

## 🚧 **Roadmap**

- [ ] Add `worklog milestone` command for milestone management
- [ ] Add `worklog decision` command for ADR creation
- [ ] Create validation scripts in `artifacts/scripts/`
- [ ] Add CLI tool for worklog commands
- [ ] Support for initiative templates
- [ ] Git integration for automatic commits
- [ ] Analytics dashboard (session frequency, milestone progress)

---

## 🤝 **Contributing**

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`feat/your-feature`)
3. Follow existing naming conventions
4. Update documentation (SKILL.md, RAILGUARDS.md)
5. Submit a pull request

**Guidelines:**
- Use kebab-case for branch names
- Follow conventional commits (feat:, fix:, docs:, etc.)
- Add tests or examples for new features

---

## 📄 **License**

MIT License - feel free to use, modify, and distribute.

---

## 🙏 **Acknowledgments**

Built for use with:
- [Claude Code](https://claude.ai/) - AI coding assistant
- [Pi Subagents](https://github.com/thoughtbot/pi-subagents) - Subagent orchestration
- Any AI assistant supporting custom skills

---

## 📞 **Support**

- 🐛 **Issues:** [GitHub Issues](https://github.com/yonnyviz/worklog/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/yonnyviz/worklog/discussions)
- 📧 **Contact:** yonny.vizcaya@unosquare.com

---

## ⭐ **Show Your Support**

If Worklog helps you stay organized, give it a star! ⭐

---

**Made with ❤️ for developers who value organized, persistent, AI-assisted workflows**

*Last updated: 2024-01-15 | Version: 1.1*

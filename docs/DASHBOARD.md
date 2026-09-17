# 🔨 Forge Dashboard (M4 / V1)

Forge Dashboard is a local, read-only server. The dashboard reads initiative Markdown and JSON directly; it does not create a database or copy initiative content.

## Commands

From a shell:

```sh
forge dashboard start
forge dashboard status
forge dashboard open
forge dashboard stop
```

From Pi, use the matching slash commands:

```text
/forge dashboard start
/forge dashboard status
/forge dashboard open
/forge dashboard stop
```

Both interfaces call the same lifecycle manager and therefore reuse the same server.

## Configuration

The first start creates `~/.forge/dashboard.json`:

```json
{
  "initiativeRoots": ["~/Documents/initiatives"]
}
```

`initiativeRoots` is the allowlist of directories that may be discovered or read. Set `FORGE_DASHBOARD_CONFIG` to use another config file. `FORGE_INITIATIVES_DIR` supplies the default root when the config is first created.

The runtime record is stored beside the config as `dashboard-runtime.json` (or at `FORGE_DASHBOARD_RUNTIME`). It contains only the PID, port, start time, and launch identity. It is operational state and is never written into an initiative.

## Initiative contract

Front matter is optional. When present at the beginning of `README.md`, these keys are supported:

- `title` — display title
- `status` — current state
- `progress` — number or percentage from 0 to 100
- `updated` — ISO date or another JavaScript-recognized date
- `next_action` — the next useful action

Existing Forge folders remain supported without front matter. The reader falls back to `.forge/metadata.json`, `README.md`, `.claude.md`, `planning/ROADMAP.md`, and `docs/DECISIONS.md`. Invalid or missing optional metadata produces a best-effort summary instead of hiding the initiative.

Only Markdown and JSON files beneath an allowlisted initiative root can be read. Resolved paths are checked again to prevent traversal through symlinks.

## Server boundary

The M1 server is intentionally dependency-free so the Pi extension remains installable without a dashboard build step. It provides a small HTTP boundary:

- `GET /_forge/health` — lifecycle identity check
- `GET /api/initiatives` — normalized summaries with detail metadata
- `GET /api/initiatives/:id` — one normalized detail record
- `GET /api/initiatives/:id/files` — visible Markdown/JSON paths
- `GET /api/initiatives/:id/files?path=README.md` — one file

The browser root (`/`) provides the V1 experience: responsive initiative cards, focused detail pages, safe content navigation, dependency-free Markdown rendering, milestones, decisions, durable session activity, source links, light/dark themes, reduced-motion support, and explicit sparse/loading/error states. It polls the source API every five seconds while visible and also provides a manual Refresh control.

## Release behavior

- The dashboard is local-only and read-only; initiative files remain the source of truth.
- Refresh polling stops while the browser tab is hidden and resumes when it is visible.
- Invalid configuration and unreadable files are shown as recoverable diagnostics in the browser and do not create or modify initiative data.
- Run `npm run verify` from a clean checkout to perform syntax checks and the fixture test suite.
- Automatic file watching is intentionally not used in V1; polling avoids platform-specific watcher behavior while keeping source changes visible promptly.

## V1 limitations

The dashboard does not edit files, maintain live collaboration, send notifications, authenticate users, or provide cloud synchronization. Markdown rendering covers the supported read-only presentation needs and is not a complete CommonMark implementation.

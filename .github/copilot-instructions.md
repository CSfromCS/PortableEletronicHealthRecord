# Copilot Instructions

Before coding, read `DevPlan.md` and follow it as the source of truth for scope and priorities.

## Required workflow
1. Read `DevPlan.md` before making code changes.
2. Implement only what matches the current phase and scope in `DevPlan.md`.
3. If implementation changes roadmap status, completed work, or priorities, update `DevPlan.md` in the same task.
4. For user-visible or behavior-changing updates, bump `package.json` version so app footer version changes and can be verified.

## Priorities
1. Preserve MVP simplicity (personal offline clerk tool, no backend/auth).
2. Keep Dexie model simple (`patients`, `dailyUpdates`) unless explicitly asked to add structure.
3. Implement only requested UX; avoid adding extra screens/components.
4. Prefer focused, minimal edits and keep style consistent.

## Current known gaps (Phase 1)
- Patient list search/sort/filter controls
- Settings page for JSON backup/import and clearing discharged patients
- Debounced/autosave for daily updates
- Optional Web Share integration (clipboard remains baseline)

## Maintenance
- Keep `DevPlan.md` synchronized with implementation status.
- Bump `package.json` version on meaningful user-visible changes.
- Keep README setup/run instructions accurate.

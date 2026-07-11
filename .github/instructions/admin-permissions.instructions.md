---
applyTo: "src/App.jsx,src/components/SuperAdminPanel.jsx,src/security/accessControl.js,backend/server.js,backend/migrations/init.js"
description: "Use when changing unified Usuarios y Cuentas flows, role permissions, permission persistence, or access control behavior. Guards against mixing effective permissions with overrides and against breaking the unified admin workflow."
---

# Admin Permissions And Unified Management

Use this instruction when editing the unified `Usuarios y Cuentas` flow or anything that affects module access.

## Core Rules
- Keep `Usuarios y Cuentas` unified. Do not reintroduce a separate legacy `cuentas` flow unless the task explicitly requires it.
- Treat role base permissions and per-user overrides as different concepts.
- Persist only permission overrides to the database, never fully resolved permission maps.
- When canceling an edit flow, revert temporary permission changes instead of leaving them in shared global state.
- If editing a player touches an associated account, persist only the intended account fields; do not overwrite unrelated account data from stale snapshots.

## Frontend Expectations
- `src/security/accessControl.js` defines the role base matrix.
- `src/App.jsx` should keep override state separate from effective permissions derived for rendering.
- `src/components/SuperAdminPanel.jsx` may show effective permissions in the UI, but save payloads must serialize only override diffs.
- Any permission toggle inside edit forms should operate on local draft state until the user presses save.

## Backend Expectations
- Account permission persistence lives on the `cuentas` record.
- Schema changes for permission persistence must be mirrored in both:
  - runtime column guards in `backend/server.js`
  - bootstrap migration in `backend/migrations/init.js`
- Keep backend payload handling tolerant of missing permission fields.

## Validation Checklist
After changes in this area, validate all of the following before publishing:
- `npm run build`
- `node --check backend/server.js`
- Saving a modified account preserves its permission changes
- Canceling an edit does not leak permission changes into later edits
- Changing a role recomputes base permissions correctly
- Reopening the same account reflects persisted overrides correctly

## Related Docs
- General repository guidance: [AGENTS.md](AGENTS.md)
- Access control definitions: [src/security/accessControl.js](src/security/accessControl.js)
- Deployment notes: [DEPLOYMENT.md](DEPLOYMENT.md)

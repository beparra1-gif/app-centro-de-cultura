# AGENTS.md

## Scope
These instructions apply to the whole repository.

## Project Shape
- Frontend: React 19 + Vite app in [src](src) with a large orchestration file in [src/App.jsx](src/App.jsx) and feature panels under [src/components](src/components).
- Backend: Node/Express API. [backend/server.js](backend/server.js) is only the entry point (dotenv, `listen`, boot tasks); [backend/app.js](backend/app.js) holds global middlewares and mounts one `express.Router` per domain from [backend/routes](backend/routes) (routes keep their full `/api/...` path); shared helpers live in [backend/lib](backend/lib). PostgreSQL schema bootstrap in [backend/migrations/init.js](backend/migrations/init.js); runtime `ensure*` guards in [backend/lib/esquema.js](backend/lib/esquema.js), run in order by [backend/lib/arranque.js](backend/lib/arranque.js).
- API boundary: frontend talks only through [src/api/client.js](src/api/client.js).
- Access control lives in [src/security/accessControl.js](src/security/accessControl.js).

## Commands
- Frontend dev: `npm run dev`
- Frontend build: `npm run build`
- Frontend lint: `npm run lint`
- Frontend tests: `npm run test`
- Backend dev: `cd backend; npm run dev`
- Backend prod-style run: `cd backend; npm start`
- Backend migrate/init: `cd backend; npm run migrate`
- Google Sheets import: `cd backend; npm run import:sheets`

## Working Rules
- Validate frontend changes with `npm run build` before considering the task done.
- Validate backend syntax with `node --check` on every changed backend file (server.js, app.js, routes/*.js, lib/*.js) when backend routes or boot logic change.
- Keep changes minimal and local; this codebase has a lot of working behavior concentrated in a few big files.
- Use existing API helpers in [src/api/client.js](src/api/client.js) instead of ad hoc fetch calls.
- Prefer extending current admin flows instead of creating parallel screens; the project is actively moving toward unified management views.

## Important Conventions
- Role normalization matters. Always pass roles through the helpers in [src/security/accessControl.js](src/security/accessControl.js).
- Schema additions must use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` patterns in [backend/migrations/init.js](backend/migrations/init.js) and, when needed, runtime guards in [backend/lib/esquema.js](backend/lib/esquema.js) (add new ones to the ordered list in [backend/lib/arranque.js](backend/lib/arranque.js)).
- Logo/image assets are handled through backend upload endpoints and rendered with the shared avatar component patterns already present in the codebase.
- RUT validation is a hard requirement for account and player records.

## Known Friction Points
- [src/App.jsx](src/App.jsx) is large and stateful; changing one flow can easily affect unrelated screens.
- Permissions work is sensitive: distinguish role base permissions from per-user overrides. Do not persist fully resolved permission maps when only overrides should be stored.
- Backup automation exists in the backend and production behavior depends on environment variables; review [backend/README.md](backend/README.md) and [ENV_VARIABLES.md](ENV_VARIABLES.md) before changing backup or deploy logic.
- Production deploys are triggered by pushes to `main`; review [DEPLOYMENT.md](DEPLOYMENT.md) instead of duplicating deploy steps here.

## Files To Read First
- [README.md](README.md)
- [backend/README.md](backend/README.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)
- [ENV_VARIABLES.md](ENV_VARIABLES.md)
- [src/security/accessControl.js](src/security/accessControl.js)
- [src/api/client.js](src/api/client.js)

## When Editing Admin / Permissions
- Keep `Usuarios y Cuentas` unified unless the task explicitly asks to restore a legacy split.
- If you change account or player editing flows, verify both persistence and post-save reload behavior.
- For permission-related changes, review both frontend state handling and backend persistence before publishing.

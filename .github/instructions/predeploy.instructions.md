---
applyTo: "src/App.jsx,src/components/**,src/api/client.js,backend/server.js,backend/migrations/init.js"
description: "Use when preparing a deploy, validating a production fix, or touching frontend/backend integration. Enforces the minimum checks before publishing changes."
---

# Predeploy Validation

Before considering a change ready for production, run the narrowest relevant checks and then the project-level checks below.

## Minimum Required Checks
- Frontend: `npm run build`
- Backend syntax: `node --check backend/server.js`

## When Backend Schema Or Persistence Changes
Also verify:
- affected endpoint round-trip with local API when possible
- migration/runtime column compatibility in both:
  - [backend/migrations/init.js](backend/migrations/init.js)
  - [backend/server.js](backend/server.js)

## When Admin / Permissions Change
Also verify:
- account save persists expected permission state
- reopening the edited record shows the same state
- role changes do not permanently flatten role base permissions into overrides
- canceling an edit does not leak unsaved permission changes into shared state

## When Production Is Involved
- Prefer validating health/status endpoints before broader manual checks.
- For this repo, review:
  - [DEPLOYMENT.md](DEPLOYMENT.md)
  - [backend/README.md](backend/README.md)
  - [ENV_VARIABLES.md](ENV_VARIABLES.md)
- If a change depends on secrets or environment variables, distinguish clearly between:
  - code correctness
  - deployment status
  - environment configuration status

## Do Not Skip
- Do not publish based only on a successful build if the change affects persistence, auth, permissions, or admin flows.

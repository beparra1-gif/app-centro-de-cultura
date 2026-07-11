---
description: Run a concise production smoke test for this project after deploys, focusing on health, auth, admin workflows, and recent change areas.
mode: ask
---

Run a production smoke test for this repository.

Workflow:
1. Identify the most relevant deployed surface from recent changes.
2. Verify backend availability first.
3. Check the smallest set of critical workflows affected by the recent work.
4. Distinguish clearly between:
   - deploy/code issue
   - environment/secrets issue
   - data issue
   - UI-only issue
5. Report findings first, then remaining risks.

Repository-specific focus:
- Backend health endpoint
- Admin / SuperAdmin flows
- Usuarios y Cuentas unified management
- Permission persistence if that area changed
- Backup/status endpoints if backend ops changed

Use these docs for context, do not duplicate them:
- [AGENTS.md](AGENTS.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)
- [backend/README.md](backend/README.md)
- [ENV_VARIABLES.md](ENV_VARIABLES.md)

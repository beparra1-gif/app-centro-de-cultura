---
description: Validate the permissions flow locally before deploying. Runs the technical checklist and confirms save/cancel/role-change behavior for the unified Usuarios y Cuentas flow.
mode: ask
---

Run a local permissions flow validation for this repository.

## Technical Checks (run in order)

1. `npm run build` — must pass with zero errors.
2. `node --check backend/server.js` — must produce no output (syntax clean).
3. Start backend: `cd backend && node server.js`
4. Fetch a test account:
   ```powershell
   $cuenta = Invoke-RestMethod -Uri 'http://localhost:3000/api/cuentas' -Method Get | Select-Object -First 1
   $id = $cuenta.id
   ```
5. Persist a permission override:
   ```powershell
   $body = @{ permisos_override = @{ comunicaciones = $true; admin_dashboard = $false } } | ConvertTo-Json
   Invoke-RestMethod -Uri "http://localhost:3000/api/cuentas/$id" -Method Put -ContentType 'application/json' -Body $body
   ```
6. Reload the account and verify the override persisted:
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:3000/api/cuentas/$id" -Method Get | Select-Object id,permisos_override
   ```
7. Restore the account's override to `{}` before finishing.

## Behavioral Checks To Verify Manually

- Saving an account with modified permissions persists only the diff from role base (not the full effective map).
- Canceling an edit does not leave temporary permission changes visible in the UI.
- Changing a role updates the base permissions correctly without being blocked by stale overrides.
- Reopening the same account shows the saved overrides correctly.

## Key Files For Context
- [src/App.jsx](src/App.jsx) — `restaurarPermisosAntesCancelacion`, `recargarUsuariosAdmin`
- [src/components/SuperAdminPanel.jsx](src/components/SuperAdminPanel.jsx) — `getPermisosPersistibles`, `cancelarEdicion`, `iniciarEdicion`
- [src/security/accessControl.js](src/security/accessControl.js) — `obtenerPermisosEfectivos`, role definitions
- [backend/server.js](backend/server.js) — `PUT /api/cuentas/:id`

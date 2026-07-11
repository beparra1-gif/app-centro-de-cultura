---
applyTo: "backend/server.js,backend/migrations/init.js"
description: "Use when changing backup automation, ops-status, sync-sheets, or backup manifest logic. Guards against breaking scheduled backup execution, manifest update, or S3 upload flow."
---

# Backup And Operational Status

Use this instruction when editing backup scheduling, backup manifest handling, ops-status reporting, or S3/Spaces upload integration.

## Key Variables
All backup behavior is controlled at runtime through environment variables. Check [backend/README.md](backend/README.md) and [ENV_VARIABLES.md](ENV_VARIABLES.md) before modifying defaults.

Critical envs: `BACKUP_ENABLED`, `BACKUP_CRON`, `BACKUP_RUN_ON_START`, `BACKUP_ALLOW_JSON_FALLBACK`, `BACKUP_MANIFEST_PATH`, `BACKUP_DIR`, `BACKUP_S3_*`, `BACKUP_UPLOAD_ENABLED`, `BACKUP_UPLOAD_REQUIRED`.

## Backup Fallback Rules
- If `pg_dump` is unavailable or reports version mismatch, the system falls back to a JSON snapshot when `BACKUP_ALLOW_JSON_FALLBACK=true`.
- Never remove the JSON fallback path; it is the only viable strategy on many hosted runtimes.
- If `BACKUP_UPLOAD_REQUIRED=true` and upload fails, the backup run is marked as error. Do not change this without explicit intent.

## Manifest Format
The manifest file must contain at least: `lastSuccessAt`, `latestBackupAt`, `filePath`, `status`. Do not remove or rename these keys; `getBackupStatus()` reads them by name.

## Operational Endpoints
These endpoints require `x-sync-token` matching `ADMIN_SYNC_TOKEN`:
- `GET /api/admin/backup-status` — health of last backup + manifest
- `POST /api/admin/backup-run` — manual backup trigger
- `GET /api/admin/ops-status` — combined DB + sync + backup status
- `POST /api/admin/sync-sheets` — Google Sheets import

## Validation After Changes
- `node --check backend/server.js`
- Verify `GET /api/admin/backup-status` returns `healthy: true` after a backup run
- Verify `POST /api/admin/backup-run` returns `ok: true` with expected `strategy`
- If S3 credentials were changed, verify `upload.uploaded: true` in the response

## Related Docs
- [backend/README.md](backend/README.md) — backup endpoint documentation
- [AGENTS.md](AGENTS.md) — general repository guidance

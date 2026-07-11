# 🚀 Backend CCF (Centro de Cultura Física)

Backend API REST para la aplicación Centro de Cultura Física.

## 📋 Requisitos

- Node.js 14+
- PostgreSQL 12+
- npm o yarn

## 🔧 Instalación Local

### 1. Clonar y navegar
```bash
cd backend
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:
```
DATABASE_URL=postgresql://user:password@localhost:5432/ccf_db
PORT=3000
NODE_ENV=development
```

### 3. Crear base de datos PostgreSQL
```sql
CREATE DATABASE ccf_db;
```

### 4. Ejecutar migraciones
```bash
npm run migrate
```

### 5. Iniciar servidor
```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

---

## 📡 API Endpoints

### COMUNICACIONES
- `GET /api/comunicaciones` - Obtener todas
- `GET /api/comunicaciones/:id` - Obtener una
- `POST /api/comunicaciones` - Crear
- `PUT /api/comunicaciones/:id` - Actualizar
- `DELETE /api/comunicaciones/:id` - Eliminar

### COMENTARIOS
- `GET /api/comunicaciones/:comId/comentarios` - Obtener comentarios
- `POST /api/comunicaciones/:comId/comentarios` - Crear comentario
- `PUT /api/comentarios/:comentId/like` - Like comentario

### PAGOS
- `GET /api/pagos` - Obtener todos
- `GET /api/pagos/usuario/:usuarioId` - Pagos de usuario
- `POST /api/pagos` - Crear pago
- `PUT /api/pagos/:pagoId/validar` - Validar pago

### USUARIOS
- `GET /api/usuarios` - Obtener todos
- `GET /api/usuarios/:id` - Obtener usuario
- `POST /api/usuarios` - Crear usuario

### WHATSAPP
- `GET /api/whatsapp/contactos` - Obtener contactos
- `POST /api/whatsapp/contactos` - Agregar contacto
- `POST /api/whatsapp/enviar` - Enviar mensaje
- `DELETE /api/whatsapp/contactos/:id` - Eliminar contacto

### REPORTES
- `GET /api/reportes/engagement` - Engagement stats
- `GET /api/reportes/top-comunicaciones` - Top 10

### ENCUESTAS
- `GET /api/encuestas` - Obtener todas
- `POST /api/encuestas` - Crear encuesta
- `PUT /api/encuestas/:id/votar` - Votar

---

## 📊 Estructura Base de Datos

### USUARIOS
```sql
id | nombre | email | telefono | rol | activo | created_at
```

### COMUNICACIONES
```sql
id | titulo | cuerpo_texto | tipo | rama | urgencia | reacciones | created_at
```

### COMENTARIOS
```sql
id | comunicacion_id | usuario_id | texto | parent_id | likes | created_at
```

### PAGOS
```sql
id | usuario_id | monto | tipo | estado | comprobante | fecha_pago | created_at
```

---

## 🚀 Deploy en DigitalOcean

### 1. Crear cuenta en DigitalOcean
Ir a: https://www.digitalocean.com

### 2. Crear PostgreSQL Managed Database
- App Platform → Databases → Create
- Seleccionar PostgreSQL 14+
- Plan: $15/mes (suficiente para 1000+ usuarios)

### 3. Crear App Platform
- App Platform → Create → GitHub
- Conectar repo
- Seleccionar rama `main`
- Crear archivo `app.yaml`:

```yaml
name: ccf-backend
services:
- name: api
  github:
    repo: tu-usuario/app-centro-de-cultura
    branch: main
  build_command: npm install
  run_command: npm start
  http_port: 3000
  envs:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    scope: RUN_AND_BUILD_TIME
    value: ${db.DATABASE_URL}
  - key: PORT
    value: "3000"

databases:
- name: db
  engine: PG
  production: true
```

### 4. Configurar ambiente
- Agregar database link
- Deploy automático en cada push a main

---

## 🔄 Sincronizar con Google Sheets

El backend ya incluye importacion real de Google Sheets hacia PostgreSQL.

### Variables necesarias

```env
GOOGLE_SHEET_ID=tu-sheet-id-o-url
ADMIN_SYNC_TOKEN=token-seguro-para-sync
```

### Sincronizacion manual por script

```bash
npm run import:sheets
```

### Sincronizacion por endpoint seguro (recomendado para panel admin)

```http
POST /api/admin/sync-sheets
Header: x-sync-token: <ADMIN_SYNC_TOKEN>
```

Ejemplo con curl:

```bash
curl -X POST https://tu-backend.ondigitalocean.app/api/admin/sync-sheets \
  -H "x-sync-token: tu-token-seguro"
```

Respuesta:

```json
{
  "ok": true,
  "sheetId": "...",
  "totals": { "total": 543, "importadas": 543, "omitidas": 0, "errores": 0 },
  "detail": [],
  "syncedAt": "2026-07-10T05:00:00.000Z"
}
```

### Estado operativo (sync + DB + backup)

```http
GET /api/admin/ops-status
Header: x-sync-token: <ADMIN_SYNC_TOKEN>
```

Incluye:
- Conectividad DB
- Estado de sincronizacion y ultima ejecucion
- Resumen de pagos mensualidades
- Estado de backup (saludable o no)

### Estado de backup (endpoint dedicado)

```http
GET /api/admin/backup-status
Header: x-sync-token: <ADMIN_SYNC_TOKEN>
```

Incluye:
- `running`: indica si hay un backup ejecutándose ahora
- `lastRun`: último resultado de ejecución (éxito/error)
- `backup`: salud del backup (archivo/fecha/antigüedad)
- `backup.upload`: estado de subida a storage externo si está habilitado

### Ejecutar backup manual (forzado)

```http
POST /api/admin/backup-run
Header: x-sync-token: <ADMIN_SYNC_TOKEN>
```

Variables de entorno para backup:

```env
# Opción A: carpeta donde se guardan dumps
BACKUP_DIR=/var/backups/ccf

# Opción B: manifest JSON actualizado por tu job de backup
BACKUP_MANIFEST_PATH=/var/backups/ccf-backup-manifest.json

# umbral de antigüedad permitido
BACKUP_MAX_AGE_HOURS=36

# automatización en servidor
BACKUP_ENABLED=true
BACKUP_CRON=0 */6 * * *
BACKUP_KEEP_DAYS=7
BACKUP_RUN_ON_START=true
BACKUP_ALLOW_JSON_FALLBACK=true

# subida a S3/Spaces
BACKUP_UPLOAD_ENABLED=true
BACKUP_UPLOAD_REQUIRED=true
BACKUP_S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
BACKUP_S3_REGION=us-east-1
BACKUP_S3_BUCKET=ccf-backups
BACKUP_S3_PREFIX=ccf-db-backups
BACKUP_S3_ACCESS_KEY_ID=...
BACKUP_S3_SECRET_ACCESS_KEY=...
```

Si configuras ambas opciones, el backend prioriza BACKUP_MANIFEST_PATH.
El backend intenta usar `pg_dump`; si no existe en runtime y `BACKUP_ALLOW_JSON_FALLBACK=true`, genera respaldo JSON como contingencia.
Si `BACKUP_UPLOAD_ENABLED=true`, cada backup se sube al bucket configurado y se verifica con `HeadObject`.
Si además `BACKUP_UPLOAD_REQUIRED=true`, un fallo de subida marca el backup como error.

---

## 📝 Logs & Monitoramiento

DigitalOcean App Platform proporciona:
- ✅ Logs en tiempo real
- ✅ Métricas CPU/RAM
- ✅ Alertas
- ✅ Rollbacks automáticos

---

## 🆘 Troubleshooting

### Error: "Database connection refused"
```bash
# Verificar conexión PostgreSQL
psql $DATABASE_URL
```

### Error: "Port already in use"
```bash
# Cambiar puerto en .env
PORT=3001
```

### Error: "CORS error"
```bash
# Verificar FRONTEND_URL en .env
FRONTEND_URL=https://tu-frontend.vercel.app
```

---

## 📚 Documentación Adicional

- [Express.js Docs](https://expressjs.com/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [DigitalOcean Docs](https://docs.digitalocean.com/)

---

**Desarrollado para Centro de Cultura Física** 🏋️‍♂️

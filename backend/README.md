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

Crear Apps Script en Google Sheets:

```javascript
function sincronizarDatos() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const apiUrl = "https://tu-backend.ondigitalocean.app/api/comunicaciones";
  
  const response = UrlFetchApp.fetch(apiUrl);
  const data = JSON.parse(response.getContentText());
  
  // Escribir en Sheets
  data.forEach((row, idx) => {
    sheet.getRange(idx + 2, 1, 1, 4).setValues([[
      row.id, row.titulo, row.rama, row.urgencia
    ]]);
  });
}

// Trigger cada 24h
```

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

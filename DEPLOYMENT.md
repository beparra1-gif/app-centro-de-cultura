# 🚀 GUÍA COMPLETA DE DEPLOYMENT

## Resumen de la Arquitectura

```
┌─────────────────────────────────────┐
│ Frontend (React + Vite)             │
│ Deploy: Vercel (Gratis)             │
│ URL: https://ccf.vercel.app        │
└─────────────┬───────────────────────┘
              │ HTTP Requests
┌─────────────▼───────────────────────┐
│ Backend (Node.js + Express)         │
│ Deploy: DigitalOcean App Platform   │
│ Costo: $12/mes                      │
│ URL: https://ccf-api.ondigitalocean.app
└─────────────┬───────────────────────┘
              │ SQL Queries
┌─────────────▼───────────────────────┐
│ Base de Datos (PostgreSQL)          │
│ Deploy: DigitalOcean Managed DB     │
│ Costo: $15/mes                      │
│ TOTAL: $27/mes                      │
└─────────────────────────────────────┘
```

---

## 📋 PASO 1: Preparar Repositorio GitHub

### 1.1 Crear repo en GitHub
```bash
# Si no tienes repo aún
git init
git add .
git commit -m "Initial commit: Centro de Cultura Física"
git branch -M main
git remote add origin https://github.com/tu-usuario/app-centro-de-cultura.git
git push -u origin main
```

### 1.2 Estructura de carpetas
```
app-centro-de-cultura/
├── src/
│   ├── App.jsx
│   ├── App.css
│   ├── main.jsx
│   └── api/
│       └── client.js (NUEVO - Cliente HTTP)
├── backend/
│   ├── server.js (NUEVO - Backend Express)
│   ├── package.json (NUEVO)
│   ├── .env.example (NUEVO)
│   ├── app.yaml (NUEVO - Config DigitalOcean)
│   └── migrations/
│       └── init.js (NUEVO - Schema BD)
├── package.json (Frontend)
├── vite.config.js
└── .env.example
```

---

## 🔧 PASO 2: Setup Backend Local (Opcional - Para Testing)

```bash
cd backend
npm install
cp .env.example .env
```

Editar `.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/ccf_db
PORT=3000
NODE_ENV=development
```

---

## ☁️ PASO 3: Crear Cuenta DigitalOcean

1. Ir a: https://www.digitalocean.com
2. Registrarse (te dan $200 de crédito por 60 días)
3. Verificar email

---

## 📊 PASO 4: Crear PostgreSQL Managed Database

### 4.1 En DigitalOcean Console:
```
Control Panel → Databases → Create Database Cluster
```

### 4.2 Configuración:
- **Engine**: PostgreSQL
- **Version**: 14
- **Region**: Tu región más cercana
- **Node count**: 1 (para empezar)
- **Size**: $15/mes (1GB RAM, suficiente para 1000+ usuarios)

### 4.3 Después de crear:
- Copiar la **Connection String**
- Se verá como: `postgresql://doadmin:xxxx@db-xxx.ondigitalocean.com:25060/defaultdb?sslmode=require`

---

## 🚀 PASO 5: Crear App Platform (Backend)

### 5.1 En DigitalOcean Console:
```
Control Panel → Apps → Create App
```

### 5.2 Conectar GitHub:
- Autorizar DigitalOcean en GitHub
- Seleccionar repo: `app-centro-de-cultura`
- Seleccionar rama: `main`

### 5.3 Configurar App:
- Detectará `backend/package.json`
- Build command: `npm install`
- Run command: `npm start`
- HTTP Port: `3000`

### 5.4 Agregar Database:
- En sección "Database", conectar con PostgreSQL que creaste
- Se auto-agrega variable de entorno `DATABASE_URL`

### 5.5 Environment Variables:
```
NODE_ENV = production
PORT = 3000
DATABASE_URL = [Auto-agregado]
FRONTEND_URL = https://tu-frontend.vercel.app
```

### 5.6 Deploy:
```
Click "Create Resource" → "Deploy"
```

Esperar 2-3 minutos. Cuando termine:
- Tu backend estará en: `https://ccf-api-xxxx.ondigitalocean.app`
- Guardar esta URL

---

## 🌐 PASO 6: Deploy Frontend en Vercel

### 6.1 Ir a Vercel:
```
https://vercel.com/new
```

### 6.2 Importar proyecto:
- Seleccionar GitHub repo
- Autorizar Vercel

### 6.3 Configurar Frontend:
- Build command: `npm run build`
- Output directory: `dist`
- Framework: Vite
- Root directory: `.` (raíz)

### 6.4 Environment Variables:
```
REACT_APP_API_URL = https://ccf-api-xxxx.ondigitalocean.app/api
```

(Reemplazar con tu URL de DigitalOcean)

### 6.5 Deploy:
```
Click "Deploy"
```

Esperar 1-2 minutos. Cuando termine:
- Tu frontend estará en: `https://app-centro-de-cultura.vercel.app`

---

## ✅ PASO 7: Verificar que Todo Funciona

### 7.1 Test Health Check:
```bash
curl https://ccf-api-xxxx.ondigitalocean.app/api/health
# Debe devolver: {"status":"OK",...}
```

### 7.2 Test Frontend:
```
Abrir: https://app-centro-de-cultura.vercel.app
```

Debería cargar la app sin errores.

### 7.3 Verificar Logs:
- **Backend logs**: DigitalOcean Console → Apps → Logs
- **Frontend logs**: Vercel Dashboard → Deployments → Logs

---

## 🔄 PASO 8: Sincronizar con Google Sheets (Automático)

### 8.1 Crear Google Apps Script:

1. Abrir tu Google Sheet
2. `Extensions → Apps Script`
3. Reemplazar código con:

```javascript
function sincronizarDatos() {
  const apiUrl = "https://ccf-api-xxxx.ondigitalocean.app/api/comunicaciones";
  
  try {
    const response = UrlFetchApp.fetch(apiUrl);
    const data = JSON.parse(response.getContentText());
    
    const sheet = SpreadsheetApp.getActiveSheet();
    
    // Headers
    sheet.getRange(1, 1, 1, 5).setValues([["ID", "Título", "Rama", "Urgencia", "Fecha"]]);
    
    // Data
    data.forEach((row, idx) => {
      sheet.getRange(idx + 2, 1, 1, 5).setValues([[
        row.id,
        row.titulo,
        row.rama,
        row.urgencia,
        new Date(row.created_at).toLocaleDateString('es-CL')
      ]]);
    });
    
    Logger.log("✅ Sincronizado a las " + new Date().toLocaleTimeString());
  } catch (error) {
    Logger.log("❌ Error: " + error);
  }
}

// Ejecutar cada 24h
function crearTrigger() {
  ScriptApp.newTrigger("sincronizarDatos")
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();
}
```

4. `Run → crearTrigger`
5. Autorizar permisos

Ahora sincroniza automáticamente cada 24h a las 2 AM.

---

## 🎯 PASO 9: Configurar Dominio Personalizado (Opcional)

### 9.1 Frontend (Vercel):
- En Vercel Dashboard → Settings → Domains
- Agregar tu dominio: `ccf.tudominio.com`
- Agregar registros DNS

### 9.2 Backend (DigitalOcean):
- En DigitalOcean Console → Apps → Settings → Domains
- Agregar: `api.ccf.tudominio.com`

---

## 📊 PASO 10: Monitorear Uso y Costos

### 10.1 DigitalOcean Dashboard:
- Ver uso de BD (storage, conexiones)
- Ver logs de App Platform
- Alertas automáticas si se alcanza límite

### 10.2 Vercel Dashboard:
- Ver compilaciones
- Ver deployments
- Analytics de tráfico

### 10.3 Límites Gratuitos:
- **PostgreSQL**: Ilimitado (pagas por uso)
- **App Platform**: $12/mes (1 app)
- **Vercel**: 100GB/mes ancho de banda

---

## 🆘 TROUBLESHOOTING

### Error: "Cannot connect to database"
```bash
# Verificar connection string en .env
# Asegurarse que PostgreSQL está running
# Verificar firewall de DigitalOcean permite conexiones
```

### Error: "CORS error"
```javascript
// En backend/server.js
app.use(cors({
  origin: 'https://tu-frontend.vercel.app',
  credentials: true
}));
```

### Error: "Build failed"
```bash
# En DigitalOcean Logs
# Buscar línea roja de error
# Commit fix y push a main
# Auto-redeploy
```

### App muy lenta
```
Upgrading plan:
- App Platform: $25/mes (2 vCPU)
- PostgreSQL: $30/mes (2GB RAM)
```

---

## 📱 BONUS: Hacer PWA Descargable

Agregar en `src/index.html`:
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#007AFF">
<link rel="apple-touch-icon" href="/logo.png">
```

Crear `public/manifest.json`:
```json
{
  "name": "Centro de Cultura Física",
  "short_name": "CCF",
  "description": "Sistema de gestión del club",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#007AFF",
  "icons": [
    {
      "src": "/logo.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

Resultado: App descargable desde Chrome/Edge sin AppStore.

---

## ✨ Resumen Final

```
✅ Backend: Node.js + Express + PostgreSQL
✅ Frontend: React + Vite + Vercel
✅ BD: PostgreSQL Managed en DigitalOcean
✅ Sincronización: Google Sheets automática
✅ SSL/HTTPS: Gratis en ambas plataformas
✅ Backups: Automáticos en PostgreSQL
✅ Costo total: $27/mes

PRÓXIMAS FASES (cuando escales):
- Autenticación JWT
- Integración WhatsApp API (Twilio)
- Machine Learning predictivos
- Mobile app nativa (React Native)
- Analytics avanzados
```

---

**¿Necesitas ayuda con algo específico? Pregunta en el README o los logs.** 🚀

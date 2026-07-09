# 🔐 VARIABLES DE ENTORNO PRODUCCIÓN

## Backend - DigitalOcean App Platform

### Copiar Variables Desde Aquí:

```env
# DATABASE
# Ir a: DigitalOcean > Databases > Tu cluster > Connection > Connection String
# Copiar formato: postgresql://doadmin:PASSWORD@HOST:PORT/DBNAME
DATABASE_URL=postgresql://doadmin:xxxxx@xxxxx.ondigitalocean.com:25060/defaultdb?sslmode=require

# APLICACIÓN
NODE_ENV=production
PORT=3000

# SEGURIDAD
# Generar comando: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=abc123xyz789def...

# FRONTEND
# URL de producción de Vercel (ej: https://app-centro-de-cultura.vercel.app)
FRONTEND_URL=https://app-centro-de-cultura.vercel.app

# TERCEROS (Opcional - llenar después si necesitas)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

GOOGLE_SHEET_ID=...
GOOGLE_API_KEY=...
```

## Frontend - Vercel

```env
# URL del backend (sin /api al final)
VITE_API_URL=https://ccf-backend-xxxx.ondigitalocean.app/api
```

---

## 📝 PASO A PASO - Obtener CONNECTION_STRING

1. **DigitalOcean Panel**
2. **Databases** (lado izquierdo)
3. **Seleccionar tu cluster PostgreSQL**
4. **Tab "Connection"** (arriba)
5. **Copiar:** "Connection string (not for `pg_upgrade`)"
6. **Formato será:**
   ```
   postgresql://doadmin:XXXXXX@postgres-db-xxxxx.ondigitalocean.com:25060/defaultdb?sslmode=require
   ```

---

## 🔐 Generar JWT_SECRET

Ejecutar en terminal local:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copiar salida (formato: abc123xyz789def...)

---

## ✅ Checklist Variables

```
Backend (App Platform):
□ DATABASE_URL
□ NODE_ENV=production
□ PORT=3000
□ JWT_SECRET
□ FRONTEND_URL

Frontend (Vercel):
□ VITE_API_URL
```

**Una vez agregadas todas las variables, el deploy funcionará correctamente.**


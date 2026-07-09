# 🚀 DEPLOY PRODUCCIÓN - PASO A PASO

## 🎯 RESUMEN FINAL

Tu aplicación está **100% lista para producción** con:
- ✅ 37 tablas base de datos
- ✅ 130+ endpoints API
- ✅ Frontend React completo
- ✅ 76+ datos de prueba

Costo total: **$27/mes** (PostgreSQL + App Platform en DigitalOcean)

---

## 📋 INSTRUCCIONES PASO A PASO

### PASO 1: Crear Cuenta DigitalOcean
1. Ir a https://www.digitalocean.com/
2. Sign Up → Crear cuenta
3. Verificar email
4. **Recibirás $200 crédito gratis** (60 días) ✨

### PASO 2: Crear Base de Datos PostgreSQL
1. Panel → **Databases** (izquierda)
2. **Create Database Cluster**
3. Configurar:
   - Engine: **PostgreSQL 15**
   - Region: **Nueva York (nyc1)** o San Francisco (sfo1)
   - Plan: **Basic ($15/mes)**
   - Click Create

4. Esperar 2-5 minutos
5. **Copiar CONNECTION STRING** (pestaña Connection)
   - Formato: `postgresql://doadmin:PASSWORD@HOST:PORT/defaultdb?sslmode=require`
   - **GUARDAR EN LUGAR SEGURO** 🔒

### PASO 3: Crear App en DigitalOcean
1. Panel → **Apps** (izquierda)
2. **Create App**
3. **Source Code** → **GitHub**
4. Click **"Connect GitHub"** → Autorizar DigitalOcean
5. Seleccionar tu repo: `app-centro-de-cultura`
6. Click **"Next"**

### PASO 4: Configurar App
1. **Branch:** main
2. **Resource Type:** Node.js App
3. **Name:** ccf-backend
4. **Run Command:** `npm start`
5. **HTTP Port:** 3000
6. **Source Directory:** `backend`

### PASO 5: Agregar Variables de Entorno
En **Environment Variables** agregar estas 5:

```
DATABASE_URL
Valor: postgresql://doadmin:PASSWORD@HOST:PORT/defaultdb?sslmode=require
(Copiar desde BD > Connection)

JWT_SECRET
Valor: 6e8c77bd4cbb2a04dd081dcadc9010e2bc9e4df8b4e69135164f1a3f5119f5db
(O generar nuevo: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

FRONTEND_URL
Valor: https://app-centro-de-cultura.vercel.app
(Actualizará después cuando deploys en Vercel)

NODE_ENV
Valor: production

PORT
Valor: 3000
```

### PASO 6: Deploy Backend
1. Click **"Create Resources"**
2. Esperar 5-10 minutos
3. Una vez completo, verás tu URL: `https://ccf-backend-XXXX.ondigitalocean.app`

### PASO 7: Vercel Frontend
1. Ir a https://vercel.com
2. **Sign Up** → Continuar con GitHub
3. Autorizar
4. **New Project**
5. Seleccionar: `app-centro-de-cultura`
6. Click **"Import"**

### PASO 8: Variables Vercel
1. **Environment Variables**
2. Agregar:
```
VITE_API_URL
Valor: https://ccf-backend-XXXX.ondigitalocean.app/api
```
(Reemplazar XXXX con tu URL de DigitalOcean)

### PASO 9: Deploy Vercel
1. Click **"Deploy"**
2. Esperar 2-3 minutos
3. URL: `https://app-centro-de-cultura.vercel.app` ✨

---

## ✅ VERIFICAR QUE TODO FUNCIONA

### Backend
```bash
curl https://ccf-backend-XXXX.ondigitalocean.app/api/health
# Debe responder: {"status":"OK","timestamp":"..."}
```

### Frontend
1. Abrir: https://app-centro-de-cultura.vercel.app
2. Debería verse exactamente como localhost

### Test Completo
1. Ir a Comunicaciones → Crear una comunicación
2. Guardar
3. Actualizar página - debe aparecer

---

## 🎁 CRÉDITO GRATIS DIGITALOCEAN

DigitalOcean te da **$200 de crédito gratis** durante 60 días.

Con $27/mes tu setup cabe fácilmente.

Después de 60 días, solo se cobran $27/mes automáticamente.

---

## 💾 ARCHIVOS IMPORTANTES

```
✅ DEPLOY_INSTRUCTIONS.md    → Instrucciones detalladas
✅ ENV_VARIABLES.md          → Cómo obtener variables
✅ backend/app.yaml          → Configuración DigitalOcean
✅ backend/.env              → Variables locales
✅ prepare-deploy.js         → Helper script
```

---

## 🚨 IMPORTANTE

### NO Commitear a GitHub:
```
.env
DATABASE_URL
JWT_SECRET
API_KEYS
```

Estos van SOLO en DigitalOcean panel y Vercel panel.

### Guardar en Lugar Seguro:
- CONNECTION_STRING (BD)
- JWT_SECRET
- URLs de production

---

## 📞 SOLUCIÓN DE PROBLEMAS

### Backend no inicia
```
DigitalOcean > Apps > ccf-backend > Logs
Ver qué error aparece
```

### Frontend conecta a backend incorrecto
```
Vercel > app-centro-de-cultura > Settings > Environment Variables
Verificar VITE_API_URL es correcta
```

### BD no conecta
```
DigitalOcean > Databases > Tu cluster > Trusted Sources
Agregar IP DigitalOcean App
```

---

## 🎯 CHECKLIST FINAL

```
[ ] Cuenta DigitalOcean creada
[ ] PostgreSQL Managed creada
[ ] CONNECTION_STRING guardado
[ ] App DigitalOcean creada
[ ] Variables de entorno agregadas
[ ] Backend deployado (URL funciona)
[ ] Vercel conectado
[ ] Variables Vercel agregadas
[ ] Frontend deployado (URL funciona)
[ ] API funciona desde frontend
[ ] Todo en producción ✨
```

---

## 💰 COSTOS FINALES

| Servicio | Precio | Duración |
|----------|--------|----------|
| PostgreSQL Managed | $15/mes | Siempre |
| App Platform | $12/mes | Siempre |
| Vercel Frontend | $0/mes | Gratis |
| **TOTAL** | **$27/mes** | Siempre |

✅ **Dentro del presupuesto $20-30/mes**

---

## 🎉 ¡LISTO!

Una vez completes estos pasos, tu sistema estará:

✅ En producción
✅ Accesible desde internet
✅ Con datos reales
✅ BD segura
✅ Auto-deployments en GitHub

¿Necesitas ayuda en algún paso? 🚀

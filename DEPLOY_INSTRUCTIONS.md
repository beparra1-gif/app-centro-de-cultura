# 🚀 GUÍA DE DEPLOY A DIGITALOCEAN + VERCEL

## PASO 1: Crear Cuenta en DigitalOcean

### 1.1 Registrarse
1. Ir a https://www.digitalocean.com/
2. Click en "Sign Up"
3. Usar email: tu-email@gmail.com
4. Crear contraseña fuerte
5. Verificar email

### 1.2 Agregar Métodos de Pago
1. Panel → Account → Billing
2. Add Payment Method → Tarjeta Crédito/Débito
3. Agregar información de pago
4. **Nota:** DigitalOcean da $200 crédito gratuito por 60 días

---

## PASO 2: Crear PostgreSQL Managed Database

### 2.1 Crear BD
1. Panel → Databases
2. Click "Create Database Cluster"
3. Configurar:
   - **Engine:** PostgreSQL (versión 15)
   - **Region:** New York (nyc1) o San Francisco (sfo1)
   - **Database Node:** Basic ($15/mes) - suficiente
   - **Name:** ccf-db
   - Crear

### 2.2 Configuración de BD
1. Esperar 2-5 minutos creación
2. Ir a pestaña "Connection"
3. **Copiar CONNECTION STRING** (formato: postgresql://...)
4. Guardar en lugar seguro - **NECESARIA PARA BACKEND**

### 2.3 Crear Base de Datos y Usuario
1. En panel BD → "Connection Pool"
2. Crear pool: `connection_pool` (Mode: Transaction)
3. Copiar CONNECTION STRING del pool

---

## PASO 3: Crear App Platform (Backend)

### 3.1 Conectar GitHub
1. Panel → Apps
2. Click "Create App"
3. "Source Code" → GitHub
4. Click "Connect GitHub"
5. Autorizar DigitalOcean en GitHub
6. Seleccionar tu repo: `app-centro-de-cultura`

### 3.2 Configurar App
1. Seleccionar rama: `main`
2. Click "Next"
3. En "Resource Type": Select "Node.js"
4. Configurar:
   - **Name:** ccf-backend
   - **Port:** 3000
   - **Build Command:** `npm install`
   - **Run Command:** `npm start`

### 3.3 Agregar Variables de Entorno
Click "Edit" en Environment variables y agregar:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://[CONEXION_STRING_AQUI]
JWT_SECRET=tu-secreto-super-seguro-cambiar-en-prod
FRONTEND_URL=https://tu-dominio-vercel.vercel.app
```

### 3.4 Conectar Base de Datos
1. "Resources" tab → "Add Resource" → "Database"
2. Seleccionar tu cluster PostgreSQL
3. Confirmar

### 3.5 Deploy
1. Review everything
2. Click "Create Resources"
3. Esperar 5-10 minutos deployment

**🎯 Al completar verás URL como:** `https://ccf-backend-xxxx.ondigitalocean.app`

---

## PASO 4: Configurar Vercel (Frontend)

### 4.1 Acceder a Vercel
1. Ir a https://vercel.com
2. Click "Sign Up" → "Continue with GitHub"
3. Autorizar Vercel
4. Importar proyecto

### 4.2 Importar Proyecto
1. "New Project"
2. Buscar y seleccionar: `app-centro-de-cultura`
3. Click "Import"

### 4.3 Configurar Variables
En "Environment Variables" agregar:

```
VITE_API_URL=https://ccf-backend-xxxx.ondigitalocean.app/api
```

(Reemplazar con URL real de DigitalOcean)

### 4.4 Deploy
1. Click "Deploy"
2. Esperar 2-3 minutos
3. **URL Vercel:** `https://app-centro-de-cultura.vercel.app`

---

## PASO 5: Sincronizar Dominios (Opcional)

Si tienes dominio propio (ej: ccf-viña.cl):

### Para Backend (DigitalOcean)
1. Comprar dominio o usar existente
2. Panel App → Settings → Domains
3. Agregar dominio custom
4. Seguir instrucciones DNS

### Para Frontend (Vercel)
1. Proyecto → Settings → Domains
2. Agregar dominio custom
3. Actualizar DNS records

---

## PASO 6: Verificar Deploy

### Backend
```bash
curl https://ccf-backend-xxxx.ondigitalocean.app/api/health
# Debe retornar: {"status":"OK","timestamp":"..."}
```

### Frontend
Abrir en navegador:
```
https://app-centro-de-cultura.vercel.app
```

### Test Completo
1. Login en frontend
2. Crear una comunicación
3. Verificar que aparezca en backend
4. Revisar base de datos

---

## 🔐 COSTOS ESTIMADOS

| Servicio | Precio | Notas |
|----------|--------|-------|
| **PostgreSQL Managed** | $15/mes | Básico, escalable |
| **App Platform (Backend)** | $12/mes | 1 GB RAM, 0.5 CPU |
| **Vercel (Frontend)** | $0/mes | Plan gratuito |
| **Dominio (opcional)** | $12/año | Nuevos dominios |
| **TOTAL** | **$27/mes** | Sin dominio custom |

---

## 📋 CHECKLIST FINAL

```
□ Cuenta DigitalOcean creada
□ Método de pago agregado
□ PostgreSQL Managed creada
□ CONNECTION_STRING guardado
□ App Platform creada
□ Variables de entorno configuradas
□ Backend deployado y funcionando
□ Vercel conectado a GitHub
□ Variables de entorno Vercel
□ Frontend deployado
□ URLs funcionando
□ Base de datos conectada
```

---

## ⚠️ IMPORTANTE

**Guardar en lugar seguro:**
- CONNECTION_STRING BD
- JWT_SECRET
- URLs de production
- Credentials API keys

**NO** commitear credentials en GitHub!

---

## 🆘 Troubleshooting

### Backend no inicia
```bash
# Revisar logs
heroku logs --tail
# O en DigitalOcean panel: Apps > Logs
```

### BD no conecta
```bash
# Verificar CONNECTION_STRING
echo $DATABASE_URL
# Verificar firewall: Databases > Settings > Trusted Sources
```

### Frontend conecta a backend incorrecto
```bash
# Verificar .env en Vercel
VITE_API_URL=https://ccf-backend-xxxx.ondigitalocean.app/api
```

---

**Una vez completados estos pasos, el sistema estará 100% en producción y accesible desde internet.**

¿Listo para empezar? 🚀

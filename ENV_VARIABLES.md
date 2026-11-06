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


## 🛡️ Seguridad (agregado 2026-11)

- `TRUST_PROXY` (opcional, default `1`): cuántos proxies delante del backend se consideran confiables para leer la IP real del cliente (`X-Forwarded-For`). En DigitalOcean App Platform el default `1` es el correcto; sin esto el límite de intentos de login era global para todos los usuarios. Usa `0` en local si no hay proxy.
- **Google Sheet privado**: la importación desde el Sheet ahora lee con la cuenta de servicio (`GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, las mismas del export). Con eso configurado el Sheet puede (y debe) dejar de estar compartido como "cualquiera con el enlace": basta compartirlo solo con el correo de la cuenta de servicio (como Editor) y con las personas del club. Si esas variables faltan, la importación vuelve a usar el CSV público como antes.

## ✉️ Correo: códigos de acceso (agregado 2026-11)

El primer ingreso y "¿Primera vez u olvidaste tu contraseña?" envían un **código de 6 dígitos** al correo registrado de la cuenta (vence en 15 minutos, 5 intentos). Para cuentas con correo real, la clave inicial `12345` y las claves marcadas para cambio (`forzar_clave`) ya no dan acceso: el login envía el código automáticamente.

Configurar en DigitalOcean → App → Settings → Environment Variables (marcar `SMTP_PASS` como *Encrypted*; nunca en el repositorio):

| Variable | Ejemplo | Nota |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | Servidor SMTP del proveedor |
| `SMTP_PORT` | `587` | 587 (STARTTLS) o 465 (SSL) |
| `SMTP_SECURE` | `false` | `true` solo con puerto 465 |
| `SMTP_USER` | `club@ejemplo.cl` | Usuario de la cuenta de envío |
| `SMTP_PASS` | *(contraseña de aplicación)* | Con Gmail: crear una "contraseña de aplicación" (requiere verificación en 2 pasos) |
| `EMAIL_FROM` | `Club CCF <club@ejemplo.cl>` | Remitente visible |

Sin estas variables, en producción el envío queda deshabilitado: el login sigue funcionando como antes y "Olvidé mi contraseña" ofrece escribir al club por WhatsApp. En desarrollo, los correos se guardan como archivos en `backend/.correos-dev/` (ignorado por git) en vez de enviarse.

### Cierre de la clave inicial "12345"

- `CLAVE_INICIAL_HASTA` (opcional, formato `AAAA-MM-DD`): hasta ese día inclusive (hora de Chile) las cuentas **sin correo** todavía pueden entrar con la clave inicial `12345` o con una clave marcada para cambio. **Sin esta variable, la clave inicial queda cerrada.** Úsala para anunciar una transición (por ejemplo, un mes) mientras el club entrega códigos de activación.
- Las cuentas sin correo se activan con un **código de activación** que genera un admin en *Admin → Usuarios y Cuentas → "Código de acceso"* (48 horas, un solo uso) y que se entrega por WhatsApp (botón con el mensaje listo) o en persona. La persona lo usa en *"¿Primera vez u olvidaste tu contraseña?" → "Tengo un código del club"*.
- En el primer ingreso, cada cuenta debe aceptar el **aviso de protección de datos** (texto y versión en `src/legal/avisoPrivacidad.js`; cada aceptación queda en la tabla `consentimientos_datos`) y, si no tiene correo, se le pide registrarlo y verificarlo con un código.

## 💾 Backups: frecuencia, tamaño y retención (2026-11)

- Por defecto: **un backup diario** (`BACKUP_CRON`, default `0 4 * * *` UTC) y **sin backup al arrancar** (`BACKUP_RUN_ON_START`, default `false`). Antes eran cada 6 h + uno en cada deploy.
- Los backups se guardan **comprimidos (gzip)** y los archivos binarios (fotos, logos, videos) en base64: ~74 % menos que el JSON anterior.
- **Retención en Spaces** después de cada subida: todos los de los últimos `BACKUP_S3_KEEP_DAILY` días (7), el más reciente de cada semana por `BACKUP_S3_KEEP_WEEKLY` semanas (8) y el más reciente de cada mes por `BACKUP_S3_KEEP_MONTHLY` meses (12). Nunca se borra el más reciente.
- **Borrar es irreversible**: la retención corre en **simulación** (solo informa en los logs cuántos borraría) hasta que se configure `BACKUP_S3_RETENCION_APLICAR=true` en DigitalOcean.

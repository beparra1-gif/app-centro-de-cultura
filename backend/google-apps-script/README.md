# Registro automático de cambios en el Google Sheet (gratis, sin Google Cloud)

Esto deja un registro en la pestaña `AUDITORIA_CAMBIOS` del Sheet cada vez que
el backend crea, edita o borra algo (jugadores, cuentas, pagos, etc.): qué
tabla, qué acción, quién lo hizo (RUT) y cuándo. No requiere ninguna cuenta de
pago ni Google Cloud — usa Google Apps Script, que es gratuito.

Desde esta versión, también deja un registro aparte y legible en la pestaña
**`EGRESOS_KIOSCO_REGISTRO`** cada vez que se registra un egreso de Kiosco:
fecha, descripción, monto, nombre/apellido/RUT de quien recibió el dinero, y
si quedó firma. (El script crea esa pestaña solo, la primera vez que llega un
egreso.)

## ⚠️ Si ya tenías el script desplegado antes

Ya lo instalaste una vez y ahora agregamos la parte de egresos de Kiosco.
Solo necesitas:
1. Abre el Google Sheet → **Extensiones → Apps Script** (tu proyecto ya existente).
2. Reemplaza el contenido completo por el de [`Code.gs`](./Code.gs) — **pero
   antes de guardar, vuelve a poner tu token real** en la línea
   `var SECRET_TOKEN = 'REEMPLAZA_CON_TU_TOKEN';` (el mismo que ya tenías).
3. Guarda.
4. **Implementar → Gestionar implementaciones → ícono de lápiz (editar) →
   Versión: Nueva versión → Implementar.** (Esto es necesario para que el
   cambio aplique a la misma URL que ya tengo configurada — no hace falta
   crear una implementación nueva ni pasarme una URL distinta.)

## Pasos (una sola vez, si nunca lo has instalado)

1. Abre el Google Sheet **BASE_CCF**.
2. Ve a **Extensiones → Apps Script**.
3. Borra el contenido de `Código.gs` (o `Code.gs`) que aparece por defecto y
   pega el contenido completo del archivo [`Code.gs`](./Code.gs) de esta carpeta.
4. Guarda el proyecto (ícono de disco o `Ctrl+S`). Ponle un nombre como
   "CCF Webhook Auditoría".
5. Haz clic en **Implementar → Nueva implementación**.
6. En "Selecciona el tipo", elige **Aplicación web**.
7. Configura:
   - **Ejecutar como:** Yo (tu cuenta)
   - **Quién tiene acceso:** Cualquier usuario
8. Haz clic en **Implementar**. Google puede pedirte autorizar permisos la
   primera vez — acepta (es tu propio script, sobre tu propio Sheet).
9. Copia la **URL de la aplicación web** que te muestra (termina en `/exec`).
10. Envíame esa URL — yo la configuro en el backend (local y en DigitalOcean).

## Notas

- El archivo `Code.gs` de este repositorio es una **plantilla**: trae
  `SECRET_TOKEN = 'REEMPLAZA_CON_TU_TOKEN'` a propósito, para no dejar el
  token real guardado en git. Tu script ya desplegado en Google Sheets tiene
  su propia copia con el token real — vive en tu cuenta de Google, fuera del
  repositorio, y no hace falta volver a desplegarlo.
- Si algún día quieres rotar el token: cámbialo en el editor de Apps Script
  (dentro de Google, no en este archivo) y también en la variable
  `GOOGLE_SHEETS_WEBHOOK_TOKEN` del backend.
- Si en el futuro editas el código del script, debes volver a
  **Implementar → Gestionar implementaciones → editar (lápiz) → Nueva versión**
  para que los cambios se apliquen a la URL ya existente.
- Este mecanismo solo agrega filas a `AUDITORIA_CAMBIOS` y `EGRESOS_KIOSCO_REGISTRO`;
  nunca modifica `JUGADORES`, `CUENTAS` ni `PAGOS_MENSUALIDADES`.

# Acta QA Produccion - 2026-07-10

## Estado general

- Entorno productivo operativo para usuarios.
- Frontend publicado en: https://app-centro-de-cultura.vercel.app
- Backend publicado en: https://ccf-backend-kahki.ondigitalocean.app
- Health check backend: `OK` en `/api/health`.

## Flujos validados en produccion

1. Login de administracion
- Resultado: OK
- Evidencia: acceso exitoso con super admin (`11111111-1`).

2. Citaciones
- Resultado: OK
- Evidencia:
  - Validacion de negocio activa al intentar confirmar sin torneo.
  - Creacion de citacion de prueba exitosa tras completar datos requeridos.

3. Cuentas (edicion/guardado)
- Resultado inicial: FAIL
- Error detectado: `column "logo_url" does not exist`
- Resultado final: OK
- Evidencia: guardado exitoso con mensaje de confirmacion en produccion.

4. Asistencia (Staff)
- Resultado: OK
- Evidencia: marcacion de asistencia y persistencia con confirmacion en auditoria.

## Incidencia corregida durante la validacion

### Problema
Al guardar cuentas, el backend en produccion rechazaba el `PUT /api/cuentas/:id` por dependencia de columna `logo_url` no presente en el esquema activo.

### Acciones correctivas
1. Backend hardening:
- Commit: `2d6e710`
- Cambio: compatibilidad en `INSERT/UPDATE` de cuentas sin requerir columna `logo_url`.

2. Mitigacion inmediata en frontend:
- Commit: `1bdae77`
- Cambio: `cuentasAPI.create/update` no envia `logo_url` en payload.

3. Redeploy frontend:
- Alias productivo confirmado en Vercel para `app-centro-de-cultura.vercel.app`.

## Limpieza de datos de prueba

- Busqueda de artefactos smoke en `/api/comunicaciones`: sin coincidencias.
- Estado de limpieza: OK.

## Conclusion

Sistema disponible y operativo para uso final, con flujos criticos validados en produccion y correccion aplicada al incidente detectado en Cuentas.
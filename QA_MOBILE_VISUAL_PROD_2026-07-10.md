# Acta QA Movil Visual - Produccion - 2026-07-10

## Alcance

Revision visual en viewport movil (`390x844`) sobre produccion.

## Pantallas revisadas

1. Staff - Pasar Lista
- Resultado: OK
- Validado: tarjetas de jugadores, acciones `PRESENTE/AUSENTE/JUSTIFIC.`, resumen y boton de guardado visibles y clickeables.

2. Panel Admin - Resumen (Sincronizacion Google Sheets)
- Resultado: OK
- Validado: controles de sincronizacion en columna unica sin solape (`Consultar estado`, `Ver detalle correcciones`, `Conflictos RUT jugadores`, `Sincronizar ahora`).

3. Panel Admin - Citaciones
- Resultado: OK
- Validado: formulario de creador de convocatorias correctamente apilado en movil, campos legibles y accesibles.

4. Modal de cierre de sesion
- Resultado: OK
- Validado: texto correcto y accion `SALIR` visible/funcional.

5. Portada publica movil
- Resultado: OK
- Validado: header, card principal y CTA (`Ingreso Usuarios CCF`, `Acceso Visitas`, `Quiero ser parte del Club`) sin desbordes ni superposicion.

## Hallazgos

- No se detectaron solapes bloqueantes en la revision visual movil.
- Se observaron eventos 404 intermitentes de chunks durante algunos cambios de estado post-deploy (comportamiento de cache en transicion), sin impacto funcional sostenido en una sesion limpia.

## Conclusion

UX movil visual en produccion: **aprobada** para operacion normal del usuario final.
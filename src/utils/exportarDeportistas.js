// Usuarios y Cuentas → "Exportar listado": CSV (abre en Excel) de deportistas
// con su apoderado, o de cuentas con sus pupilos, para pasar en limpio quiénes
// están. La columna "¿Sigue? (Sí/No)" va vacía a propósito: se marca a mano.
import { estaActivo } from './estadoActivo';

const norm = (rut = '') => String(rut || '').replace(/[.\s-]/g, '').trim().toUpperCase();
const correo = (c = '') => String(c || '').trim().toLowerCase();
const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
// BOM para que Excel lea bien tildes y ñ; ';' es el separador de Excel en es-CL.
const aCsv = (filas) => `${String.fromCharCode(0xFEFF)}${filas.map((l) => l.map(celda).join(';')).join('\r\n')}`;
const nombreCompleto = (p) => `${p.apellido_paterno || ''} ${p.apellido_materno || ''} ${p.nombres || ''}`;

export const construirCsvDeportistas = (jugadores = [], cuentas = []) => {
  const porRut = new Map(cuentas.map((c) => [norm(c.rut), c]));
  const porCorreo = new Map(cuentas.filter((c) => correo(c.correo).includes('@')).map((c) => [correo(c.correo), c]));
  const cabecera = ['Categoría', 'Rama', 'Apellidos', 'Nombres', 'RUT', 'Nacimiento', 'Estado',
    'Apoderado', 'RUT apoderado', 'Teléfono apoderado', 'Correo apoderado', 'Parentesco', 'Estado cuenta apoderado', '¿Sigue? (Sí/No)', 'Observación'];
  const filas = [...jugadores]
    .sort((a, b) => String(a.categoria || '').localeCompare(String(b.categoria || ''), 'es')
      || String(a.rama || '').localeCompare(String(b.rama || ''), 'es')
      || nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'))
    .map((j) => {
      const apo = porRut.get(norm(j.rut_apoderado)) || porCorreo.get(correo(j.correo_apoderado)) || null;
      return [
        j.categoria || 'Sin categoría', j.rama || 'Sin rama',
        `${j.apellido_paterno || ''} ${j.apellido_materno || ''}`.trim(), j.nombres || '', j.rut_jugador || '',
        String(j.fecha_nacimiento || '').slice(0, 10), estaActivo(j) ? 'Activo' : (j.estado || 'Inactivo'),
        apo ? `${apo.nombres || ''} ${apo.apellido_paterno || ''}`.trim() : 'Sin apoderado vinculado',
        apo?.rut || j.rut_apoderado || '',
        apo?.telefono ? `${apo.prefijo_tel || '+56'} ${apo.telefono}` : '',
        apo?.correo || j.correo_apoderado || '', j.parentesco_apoderado || '',
        apo ? (estaActivo(apo) ? 'Activa' : 'Inactiva') : '', '', '',
      ];
    });
  return aCsv([cabecera, ...filas]);
};

// Mismo listado para cuentas (apoderados, socios, staff…) con sus pupilos.
export const construirCsvCuentas = (cuentas = [], jugadores = []) => {
  const cabecera = ['Apellidos', 'Nombres', 'RUT', 'Perfil', 'Socio', 'Estado', 'Teléfono', 'Correo', 'Pupilos', '¿Sigue? (Sí/No)', 'Observación'];
  const filas = [...cuentas]
    .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'))
    .map((c) => {
      const pupilos = jugadores.filter((j) => (norm(j.rut_apoderado) && norm(j.rut_apoderado) === norm(c.rut))
        || (correo(c.correo).includes('@') && correo(j.correo_apoderado) === correo(c.correo)));
      return [
        `${c.apellido_paterno || ''} ${c.apellido_materno || ''}`.trim(), c.nombres || '', c.rut || '',
        c.perfil_principal || c.rol || '', c.es_socio ? 'Sí' : 'No', estaActivo(c) ? 'Activo' : (c.estado || 'Inactivo'),
        c.telefono ? `${c.prefijo_tel || '+56'} ${c.telefono}` : '', c.correo || '',
        pupilos.map((j) => `${j.nombres || ''} ${j.apellido_paterno || ''} (${[j.categoria, j.rama].filter(Boolean).join(' ')}${estaActivo(j) ? '' : ', inactivo'})`.replace(/\s+/g, ' ')).join(' | '),
        '', '',
      ];
    });
  return aCsv([cabecera, ...filas]);
};

export const descargarCsv = (nombreArchivo, csv) => {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo.replace(/\s+/g, '_');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

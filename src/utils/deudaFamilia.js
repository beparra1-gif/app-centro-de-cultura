// Deuda de la familia para el acceso directo de pago del Muro (PagoRapidoMuro).

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const norm = (rut = '') => String(rut || '').replace(/[.\s-]/g, '').trim().toUpperCase();

export const resumirDeudaFamilia = ({ pupilos = [], morosos = [], sociosMorosos = [], cuentaPropia = null } = {}) => {
  const rutsPupilos = new Set(pupilos.map((p) => norm(p.rut)));
  const lineas = morosos
    .filter((m) => rutsPupilos.has(norm(m.rut)))
    .map((m) => ({
      clave: `p-${norm(m.rut)}`,
      rut: m.rut,
      nombre: pupilos.find((p) => norm(p.rut) === norm(m.rut))?.nombre || m.nombre,
      meses: m.mesesMorosos || [],
      monto: Number(m.montoDeuda) || 0,
      tipo: 'pupilo',
    }));
  const socio = cuentaPropia ? sociosMorosos.find((s) => norm(s.rut) === norm(cuentaPropia.rut)) : null;
  if (socio) {
    lineas.unshift({ clave: 'socio', nombre: 'Cuota de socio', meses: socio.mesesMorosos || [], monto: Number(socio.montoDeuda) || 0, tipo: 'socio' });
  }
  return { lineas, total: lineas.reduce((s, l) => s + l.monto, 0) };
};

export const mesesANumeros = (meses = []) => meses.map((m) => MESES.indexOf(m) + 1).filter((n) => n > 0);

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Users, X } from 'lucide-react';
import * as api from '../api/client';
import useModalAccesible from '../utils/useModalAccesible';
import { ordenarCategorias } from '../utils/informeDeuda';
import { FotoPersona } from './MuroCumpleanos';

// Muro → "Conoce a nuestro staff técnico": entrenadores activos con su foto
// y las categorías que tienen a cargo (las de Usuarios y Cuentas → Staff).
// Se carga al abrir, no en cada visita al Muro.

const titulo = (t = '') => String(t).charAt(0).toUpperCase() + String(t).slice(1).toLowerCase();
const corta = (c) => String(c).replace(/\s*\/\s*SUB-/i, '/'); // "SUB-17 / SUB-18" → "SUB-17/18"

// Pares "RAMA|CATEGORÍA" agrupados en una línea por rama (antes era una
// etiqueta por categoría y la ficha se llenaba de texto).
const categoriasPorRama = (p = {}) => {
  if (!p.categorias?.length) return [[p.ramas?.length ? p.ramas.map(titulo).join(' y ') : 'Todas las ramas', ['Todas las categorías']]];
  const grupos = new Map();
  p.categorias.forEach((c) => {
    const [rama, cat] = c.includes('|') ? c.split('|') : [p.ramas?.length ? p.ramas.map(titulo).join(' y ') : 'Ambas ramas', c];
    const clave = rama.includes(' ') ? rama : titulo(rama);
    grupos.set(clave, [...(grupos.get(clave) || []), cat]);
  });
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([rama, cats]) => [rama, cats.sort(ordenarCategorias).map(corta)]);
};

function VentanaStaff({ onCerrar }) {
  useModalAccesible(true, onCerrar);
  const [staff, setStaff] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    api.staffTecnicoAPI.listar()
      .then((datos) => { if (activo) setStaff(Array.isArray(datos) ? datos : []); })
      .catch((e) => { if (activo) setError(e.message || 'No se pudo cargar el staff.'); });
    return () => { activo = false; };
  }, []);

  return createPortal(
    <div className="fp-fondo" onClick={onCerrar} role="presentation">
      <div className="fp-ventana" role="dialog" aria-modal="true" aria-labelledby="staff-titulo" onClick={(e) => e.stopPropagation()}>
        <header className="fp-cabecera">
          <span className="tc-avatar" aria-hidden="true"><Users size={18} /></span>
          <div className="fp-cabecera-texto">
            <h3 id="staff-titulo">Nuestro staff técnico</h3>
            <p>Entrenadores del club y las categorías que dirigen</p>
          </div>
          <button type="button" className="fp-cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={20} /></button>
        </header>
        <div className="fp-cuerpo">
          {error && <p className="tc-vacio">{error}</p>}
          {staff === null && !error && <p className="tc-vacio">Cargando…</p>}
          {staff?.length === 0 && <p className="tc-vacio">Todavía no hay entrenadores registrados.</p>}
          <div className="ms-grilla">
            {(staff || []).map((p) => (
              <article key={p.id} className="ms-ficha">
                <div className="ms-ficha-banda" aria-hidden="true" />
                <FotoPersona foto={p.foto} nombre={p.nombre} size={96} />
                <strong className="ms-ficha-nombre">{p.nombre}</strong>
                <span className="ms-ficha-nivel">{p.nivel || 'Staff técnico'}</span>
                <dl className="ms-ficha-categorias">
                  {categoriasPorRama(p).map(([rama, cats]) => (
                    <div key={rama}>
                      <dt>{rama}</dt>
                      <dd>{cats.join(' · ')}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function MuroStaffTecnico() {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" className="ms-boton" onClick={() => setAbierto(true)}>
        <Users size={18} aria-hidden="true" /> CONOCE A NUESTRO STAFF TÉCNICO
      </button>
      {abierto && <VentanaStaff onCerrar={() => setAbierto(false)} />}
    </>
  );
}

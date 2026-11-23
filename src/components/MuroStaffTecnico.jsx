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
              <article key={p.id} className="ms-persona">
                <FotoPersona foto={p.foto} nombre={p.nombre} size={64} />
                <strong>{p.nombre}</strong>
                {p.ramas?.length > 0 && <small className="ms-rama">{p.ramas.map((r) => r.charAt(0) + r.slice(1).toLowerCase()).join(' y ')}</small>}
                <div className="ms-categorias">
                  {p.categorias.length
                    ? [...p.categorias].sort(ordenarCategorias).map((c) => <span key={c} className="tc-perfil">{c}</span>)
                    : <span className="tc-perfil">Todas las categorías</span>}
                </div>
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

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Users, X } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { sugerirHermanos } from '../utils/sugerirHermanos';
import { planUnirHermanos } from '../utils/hermanos';

// Usuarios y Cuentas → Vincular apoderados → "Posibles hermanos": grupos que
// parecen familia (apellidos, teléfono o contacto de emergencia) y aún no lo
// están. "Unir" los marca con el mismo grupo_familiar; "No son hermanos" los
// oculta en este dispositivo.

const CLAVE_DESCARTADOS = 'ccf.hermanosDescartados';
const leerDescartados = () => {
  try { return new Set(JSON.parse(window.localStorage.getItem(CLAVE_DESCARTADOS) || '[]')); } catch { return new Set(); }
};
const firma = (g) => g.jugadores.map((j) => String(j.rut_jugador)).sort().join('|');

export default function PosiblesHermanos({ jugadores = [], onRecargar, onVerFicha }) {
  const [abierto, setAbierto] = useState(true);
  const [guardando, setGuardando] = useState(null);
  const [descartados, setDescartados] = useState(leerDescartados);

  const sugerencias = useMemo(
    () => sugerirHermanos(jugadores).filter((g) => !descartados.has(firma(g))),
    [jugadores, descartados]
  );
  if (sugerencias.length === 0) return null;

  const descartar = (g) => {
    const nuevo = new Set(descartados).add(firma(g));
    setDescartados(nuevo);
    try { window.localStorage.setItem(CLAVE_DESCARTADOS, JSON.stringify([...nuevo])); } catch { /* sin almacenamiento: solo por esta vez */ }
  };

  const unir = async (g) => {
    const { grupo, actualizar } = planUnirHermanos(g.jugadores, jugadores);
    setGuardando(g.clave);
    try {
      for (const j of actualizar) {
        await api.jugadoresAPI.update(j.rut_jugador, { grupo_familiar: grupo });
      }
      showToast({ message: `${g.jugadores.map((j) => j.nombres).join(' y ')} quedaron como hermanos.`, type: 'success' });
      await onRecargar?.();
    } catch (error) {
      showToast({ message: error.message || 'No se pudieron unir.', type: 'error' });
    } finally {
      setGuardando(null);
    }
  };

  return (
    <section className="ph-seccion" aria-label="Posibles hermanos">
      <button type="button" className="ph-titulo" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <Users size={16} /> Posibles hermanos ({sugerencias.length})
        {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {abierto && (
        <div className="ph-lista">
          <p className="fp-ayuda">Parecen familia pero no están unidos. Al unirlos se cobran con tarifa de hermanos y, cuando le asignes apoderado a uno, los demás lo reciben.</p>
          {sugerencias.map((g) => (
            <article key={g.clave} className={`va-sugerencia ph-grupo ${g.segura ? 'segura' : ''}`}>
              <div>
                <div className="ph-nombres">
                  {g.jugadores.map((j) => (
                    <button key={j.rut_jugador} type="button" className="fp-nombre-link" onClick={() => onVerFicha?.(j)}>
                      {`${j.nombres || ''} ${j.apellido_paterno || ''} ${j.apellido_materno || ''}`.trim()}{j.categoria ? ` (${j.categoria})` : ''}
                    </button>
                  ))}
                </div>
                <small>{g.motivos.join(' · ')}</small>
              </div>
              <div className="ph-botones">
                <button type="button" className="tc-btn-pagar" disabled={Boolean(guardando)} onClick={() => unir(g)}>
                  <Users size={13} /> {guardando === g.clave ? 'Guardando…' : 'Unir como hermanos'}
                </button>
                <button type="button" className="btn-secondary tc-btn" disabled={Boolean(guardando)} onClick={() => descartar(g)}>
                  <X size={13} /> No son hermanos
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

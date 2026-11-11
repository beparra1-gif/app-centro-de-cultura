import { useMemo, useState } from 'react';
import { Check, Link2, Search, X } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import { sugerirApoderados } from '../utils/sugerirApoderados';
import PosiblesHermanos from './PosiblesHermanos';

// Usuarios y Cuentas → "Vincular apoderados": deportistas sin cuenta de
// apoderado vinculada, con las cuentas más probables y el motivo. Se vincula
// de a uno o todas las sugerencias seguras de una vez (con confirmación).

const PASO = 25;
const nombreCuenta = (c) => `${c.nombres || ''} ${c.apellido_paterno || ''}`.trim() || c.correo || c.rut || 'Sin nombre';

export default function VincularApoderadosPanel({ jugadores = [], cuentas = [], onRecargar, onVerFicha }) {
  const [texto, setTexto] = useState('');
  const [limite, setLimite] = useState(PASO);
  const [guardando, setGuardando] = useState(null);
  const [vinculados, setVinculados] = useState(() => new Set());
  const [elegida, setElegida] = useState({});

  const filas = useMemo(() => sugerirApoderados({ jugadores, cuentas }), [jugadores, cuentas]);
  const pendientes = filas.filter((f) => !vinculados.has(f.jugador.rut_jugador));
  const q = texto.trim().toLowerCase();
  const visibles = pendientes.filter((f) => !q || `${f.jugador.nombres} ${f.jugador.apellido_paterno} ${f.jugador.rut_jugador}`.toLowerCase().includes(q));
  const seguras = pendientes.filter((f) => f.segura);
  const opciones = useMemo(() => cuentas
    .filter((c) => !['jugador', 'mesa', 'visita'].includes(String(c.rol || '').toLowerCase()))
    .sort((a, b) => nombreCuenta(a).localeCompare(nombreCuenta(b), 'es')), [cuentas]);

  const vincular = async (lista) => {
    let ok = 0;
    setGuardando(lista.length === 1 ? lista[0].jugador.rut_jugador : 'lote');
    try {
      for (const { jugador, cuenta } of lista) {
        await api.jugadoresAPI.update(jugador.rut_jugador, {
          rut_apoderado: cuenta.rut || null,
          ...(cuenta.correo ? { correo_apoderado: cuenta.correo } : {}),
        });
        ok += 1;
        setVinculados((prev) => new Set(prev).add(jugador.rut_jugador));
      }
      showToast({ message: ok === 1 ? `${lista[0].jugador.nombres} quedó vinculado a ${nombreCuenta(lista[0].cuenta)}.` : `${ok} deportistas vinculados.`, type: 'success' });
    } catch (error) {
      showToast({ message: `Se vincularon ${ok} de ${lista.length}. Error: ${error.message || 'no se pudo guardar'}`, type: 'error' });
    } finally {
      setGuardando(null);
      await onRecargar?.();
    }
  };

  const vincularSeguras = async () => {
    const confirmado = await confirmAction({
      title: `Vincular ${seguras.length} deportistas`,
      message: `Se vinculará cada deportista con su sugerencia segura (mismo teléfono o mismo contacto de emergencia). Podrás cambiarlo después desde su ficha.`,
      confirmText: 'Vincular',
    });
    if (confirmado) await vincular(seguras.map((f) => ({ jugador: f.jugador, cuenta: f.sugerencias[0].cuenta })));
  };

  return (
    <div className="fade-in">
      <PosiblesHermanos jugadores={jugadores} onRecargar={onRecargar} onVerFicha={onVerFicha} />

      <div className="va-cabecera">
        <p>
          <b>{pendientes.length}</b> deportistas no tienen cuenta de apoderado vinculada: su familia no ve sus pagos y no reciben avisos.
          Elige la cuenta correcta (las sugerencias explican por qué).
        </p>
        {seguras.length > 0 && (
          <button type="button" className="btn-electric tc-btn" disabled={Boolean(guardando)} onClick={vincularSeguras}>
            <Check size={14} /> Vincular {seguras.length === 1 ? '1 sugerencia segura' : `${seguras.length} sugerencias seguras`}
          </button>
        )}
      </div>

      <div className="tc-buscador">
        <Search size={16} className="tc-buscador-icono" />
        <input type="search" className="form-input" placeholder="Buscar deportista…" aria-label="Buscar deportista sin apoderado" value={texto} onChange={(e) => { setTexto(e.target.value); setLimite(PASO); }} />
        {texto && <button type="button" className="tc-buscador-limpiar" onClick={() => setTexto('')} aria-label="Limpiar búsqueda"><X size={14} /></button>}
      </div>

      {visibles.length === 0 && <p className="tc-vacio">{pendientes.length === 0 ? 'Todos los deportistas tienen apoderado vinculado. 🎉' : 'Sin resultados.'}</p>}

      <div className="va-lista">
        {visibles.slice(0, limite).map((f) => {
          const j = f.jugador;
          return (
            <article key={j.rut_jugador} className="va-fila">
              <header>
                <button type="button" className="fp-nombre-link" onClick={() => onVerFicha?.(j)}>{`${j.nombres || ''} ${j.apellido_paterno || ''} ${j.apellido_materno || ''}`.trim()}</button>
                <span className="va-meta">{j.rut_jugador} · {[j.rama, j.categoria].filter(Boolean).join(' ')}{j.nombre_emergencia ? ` · emergencia: ${j.nombre_emergencia}` : ''}</span>
              </header>
              {f.sugerencias.length > 0 ? (
                <div className="va-sugerencias">
                  {f.sugerencias.map((s, i) => (
                    <div key={s.cuenta.id || s.cuenta.rut} className={`va-sugerencia ${i === 0 && f.segura ? 'segura' : ''}`}>
                      <div>
                        <strong>{nombreCuenta(s.cuenta)}</strong>
                        <small>{s.motivos.join(' · ')}</small>
                      </div>
                      <button type="button" className="tc-btn-pagar" disabled={Boolean(guardando)} onClick={() => vincular([{ jugador: j, cuenta: s.cuenta }])}>
                        <Link2 size={13} /> {guardando === j.rut_jugador ? 'Guardando…' : 'Vincular'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : <p className="fp-ayuda">Sin pistas automáticas: elige la cuenta a mano.</p>}
              <div className="va-manual">
                <select className="form-input" aria-label={`Otra cuenta para ${j.nombres}`} value={elegida[j.rut_jugador] || ''} onChange={(e) => setElegida((p) => ({ ...p, [j.rut_jugador]: e.target.value }))}>
                  <option value="">Otra cuenta…</option>
                  {opciones.map((c) => <option key={c.id || c.rut} value={c.rut}>{nombreCuenta(c)} · {c.rut}</option>)}
                </select>
                <button
                  type="button"
                  className="btn-secondary tc-btn"
                  disabled={!elegida[j.rut_jugador] || Boolean(guardando)}
                  onClick={() => vincular([{ jugador: j, cuenta: opciones.find((c) => c.rut === elegida[j.rut_jugador]) }])}
                >
                  Vincular
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {visibles.length > limite && (
        <button type="button" className="btn-secondary tc-ver-mas" onClick={() => setLimite((n) => n + PASO)}>Ver {Math.min(PASO, visibles.length - limite)} más</button>
      )}
    </div>
  );
}

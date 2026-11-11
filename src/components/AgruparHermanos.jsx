import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search, Users, X } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import { estaVinculado } from '../utils/sugerirApoderados';
import { normGrupoFamiliar, planUnirHermanos } from '../utils/hermanos';

// Usuarios y Cuentas → Vincular apoderados → "Agrupar hermanos": el admin
// marca a mano qué deportistas sin apoderado son hermanos (mismo
// grupo_familiar). Nada se agrupa solo: la app no propone ni asigna.

const PASO = 25;
const nombreDe = (j) => `${j.apellido_paterno || ''} ${j.apellido_materno || ''}, ${j.nombres || ''}`.replace(/\s+/g, ' ').replace(/^ ?, ?/, '').trim() || j.rut_jugador;
const sinTildes = (t = '') => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function AgruparHermanos({ jugadores = [], cuentas = [], onRecargar, onVerFicha }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [marcados, setMarcados] = useState(() => new Set());
  const [limite, setLimite] = useState(PASO);
  const [guardando, setGuardando] = useState(false);

  const sinApoderado = useMemo(
    () => jugadores.filter((j) => !estaVinculado(j, cuentas)).sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es')),
    [jugadores, cuentas]
  );
  // Grupos ya armados (para mostrarlos y poder deshacerlos).
  const grupos = useMemo(() => {
    const mapa = new Map();
    jugadores.forEach((j) => {
      const g = normGrupoFamiliar(j.grupo_familiar);
      if (!g) return;
      if (!mapa.has(g)) mapa.set(g, []);
      mapa.get(g).push(j);
    });
    return [...mapa.entries()].filter(([, l]) => l.length > 1);
  }, [jugadores]);
  const nombreGrupo = useMemo(() => new Map(grupos.map(([g, l]) => [g, `Hermanos ${l[0].apellido_paterno || ''}`.trim()])), [grupos]);

  const q = sinTildes(texto.trim());
  const visibles = sinApoderado.filter((j) => !q || sinTildes(`${nombreDe(j)} ${j.rut_jugador} ${j.categoria || ''}`).includes(q));
  const seleccion = jugadores.filter((j) => marcados.has(j.rut_jugador));

  const alternar = (rut) => setMarcados((prev) => {
    const nuevo = new Set(prev);
    if (nuevo.has(rut)) nuevo.delete(rut); else nuevo.add(rut);
    return nuevo;
  });

  const agrupar = async () => {
    if (seleccion.length < 2) return;
    const { grupo, actualizar } = planUnirHermanos(seleccion, jugadores);
    setGuardando(true);
    try {
      for (const j of actualizar) await api.jugadoresAPI.update(j.rut_jugador, { grupo_familiar: grupo });
      showToast({ message: `${seleccion.map((j) => j.nombres).join(', ')} quedaron agrupados como hermanos.`, type: 'success' });
      setMarcados(new Set());
      await onRecargar?.();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo agrupar.', type: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  const desagrupar = async (grupo, lista) => {
    const confirmado = await confirmAction({
      title: 'Desagrupar hermanos',
      message: `${lista.map((j) => j.nombres).join(', ')} dejarán de estar agrupados como hermanos.`,
      confirmText: 'Desagrupar',
    });
    if (!confirmado) return;
    setGuardando(true);
    try {
      for (const j of lista) await api.jugadoresAPI.update(j.rut_jugador, { grupo_familiar: '' });
      showToast({ message: 'Grupo deshecho.', type: 'success' });
      await onRecargar?.();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo desagrupar.', type: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="ph-seccion" aria-label="Agrupar hermanos">
      <button type="button" className="ph-titulo" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <Users size={16} /> Agrupar hermanos sin apoderado{grupos.length ? ` · ${grupos.length} ${grupos.length === 1 ? 'grupo' : 'grupos'}` : ''}
        {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {abierto && (
        <div className="ph-lista">
          <p className="fp-ayuda">Marca a los deportistas que son hermanos y presiona “Agrupar”. Así se cobran con tarifa de hermanos y aparecen juntos en Tesorería mientras no tengan apoderado.</p>

          {grupos.length > 0 && (
            <div className="ph-grupos">
              {grupos.map(([g, lista]) => (
                <div key={g} className="va-sugerencia">
                  <div>
                    <strong>{nombreGrupo.get(g)}</strong>
                    <small>{lista.map((j) => j.nombres).join(' · ')}</small>
                  </div>
                  <button type="button" className="btn-secondary tc-btn" disabled={guardando} onClick={() => desagrupar(g, lista)}>
                    <X size={13} /> Desagrupar
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="tc-buscador">
            <Search size={16} className="tc-buscador-icono" />
            <input type="search" className="form-input" placeholder="Buscar deportista sin apoderado…" aria-label="Buscar para agrupar hermanos" value={texto} onChange={(e) => { setTexto(e.target.value); setLimite(PASO); }} />
          </div>

          <ul className="ph-checks">
            {visibles.slice(0, limite).map((j) => {
              const g = normGrupoFamiliar(j.grupo_familiar);
              return (
                <li key={j.rut_jugador}>
                  <label className="checkbox-label-row">
                    <input type="checkbox" checked={marcados.has(j.rut_jugador)} onChange={() => alternar(j.rut_jugador)} />
                    <span>{nombreDe(j)}{j.categoria ? ` · ${j.categoria}` : ''}</span>
                  </label>
                  {g && nombreGrupo.has(g) && <span className="tc-perfil">{nombreGrupo.get(g)}</span>}
                  <button type="button" className="fp-nombre-link ph-ver" onClick={() => onVerFicha?.(j)}>Ver ficha</button>
                </li>
              );
            })}
          </ul>
          {visibles.length === 0 && <p className="tc-vacio">Sin resultados.</p>}
          {visibles.length > limite && (
            <button type="button" className="btn-secondary tc-ver-mas" onClick={() => setLimite((n) => n + PASO)}>Ver {Math.min(PASO, visibles.length - limite)} más</button>
          )}

          <div className="ph-barra">
            <span>{seleccion.length} {seleccion.length === 1 ? 'marcado' : 'marcados'}</span>
            {seleccion.length > 0 && <button type="button" className="btn-secondary tc-btn" onClick={() => setMarcados(new Set())}>Limpiar</button>}
            <button type="button" className="btn-electric tc-btn" disabled={seleccion.length < 2 || guardando} onClick={agrupar}>
              <Users size={14} /> {guardando ? 'Guardando…' : 'Agrupar como hermanos'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

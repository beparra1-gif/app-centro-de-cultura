import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, FileText, Filter, Shield, Tv, Users } from 'lucide-react';
import { nextId } from '../utils/runtimeId';
import { calcularEff } from '../utils/appHelpers';
import LogoAvatar from './LogoAvatar';

function MesaControlPanel({
  jugadorSeleccionadoLive,
  setJugadorSeleccionadoLive,
  rosterEquipo,
  setRosterEquipo,
  liveScore,
  setLiveScore,
  playByPlay,
  setPlayByPlay,
  notaScouting,
  setNotaScouting,
  modoChromaKey,
  setModoChromaKey,
  partidos = [],
}) {
  const [modoAnalisis, setModoAnalisis] = useState('dos');
  const [filtroRama, setFiltroRama] = useState('Todas');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [filtroCompeticion, setFiltroCompeticion] = useState('Todas');
  const [equipoLocalKey, setEquipoLocalKey] = useState('LOCAL_DEFAULT');
  const [equipoVisitaKey, setEquipoVisitaKey] = useState('VISITA_DEFAULT');

  const normalizarTexto = (v = '') => String(v || '').trim();

  const rosterNormalizado = useMemo(
    () => (Array.isArray(rosterEquipo) ? rosterEquipo : []).map((j, idx) => {
      const equipoNombre = normalizarTexto(
        j.equipo_nombre || j.equipo || j.club_nombre || j.club || j.team_name || liveScore.equipoLocalNombre || 'Centro de Cultura Física'
      );
      const equipoLogoUrl = normalizarTexto(
        j.equipo_logo_url || j.logo_equipo_url || j.club_logo_url || j.logo_url || ''
      );
      const competicion = normalizarTexto(j.competicion || j.competencia || j.torneo || 'Sin competencia');

      return {
        ...j,
        id: j.id != null ? j.id : idx + 1,
        _rama: normalizarTexto(j.rama || 'General'),
        _categoria: normalizarTexto(j.categoria || 'General'),
        _competicion: competicion,
        _equipoKey: `${equipoNombre}::${equipoLogoUrl}`,
        _equipoNombre: equipoNombre,
        _equipoLogoUrl: equipoLogoUrl,
      };
    }),
    [rosterEquipo, liveScore.equipoLocalNombre]
  );

  const opcionesCompeticionPartidos = useMemo(
    () => (Array.isArray(partidos) ? partidos : [])
      .map((p) => normalizarTexto(p.torneo || p.competicion || p.competencia || ''))
      .filter(Boolean),
    [partidos]
  );

  const opcionesRama = useMemo(() => {
    const valores = new Set(rosterNormalizado.map((j) => j._rama).filter(Boolean));
    return ['Todas', ...Array.from(valores)];
  }, [rosterNormalizado]);

  const opcionesCategoria = useMemo(() => {
    const valores = new Set(rosterNormalizado.map((j) => j._categoria).filter(Boolean));
    return ['Todas', ...Array.from(valores)];
  }, [rosterNormalizado]);

  const opcionesCompeticion = useMemo(() => {
    const valores = new Set([
      ...rosterNormalizado.map((j) => j._competicion).filter(Boolean),
      ...opcionesCompeticionPartidos,
    ]);
    return ['Todas', ...Array.from(valores)];
  }, [rosterNormalizado, opcionesCompeticionPartidos]);

  const equiposDisponibles = useMemo(() => {
    const map = new Map();
    rosterNormalizado.forEach((j) => {
      if (!map.has(j._equipoKey)) {
        map.set(j._equipoKey, {
          key: j._equipoKey,
          nombre: j._equipoNombre,
          logoUrl: j._equipoLogoUrl,
        });
      }
    });

    if (map.size === 0) {
      map.set('LOCAL_DEFAULT', {
        key: 'LOCAL_DEFAULT',
        nombre: liveScore.equipoLocalNombre || 'Centro de Cultura Física',
        logoUrl: liveScore.equipoLocalLogoUrl || '',
      });
      map.set('VISITA_DEFAULT', {
        key: 'VISITA_DEFAULT',
        nombre: liveScore.equipoVisitaNombre || 'Visitante',
        logoUrl: liveScore.equipoVisitaLogoUrl || '',
      });
    }

    return Array.from(map.values());
  }, [rosterNormalizado, liveScore.equipoLocalNombre, liveScore.equipoLocalLogoUrl, liveScore.equipoVisitaNombre, liveScore.equipoVisitaLogoUrl]);

  useEffect(() => {
    if (!equiposDisponibles.find((e) => e.key === equipoLocalKey)) {
      setEquipoLocalKey(equiposDisponibles[0]?.key || 'LOCAL_DEFAULT');
    }
    if (!equiposDisponibles.find((e) => e.key === equipoVisitaKey)) {
      setEquipoVisitaKey(equiposDisponibles[1]?.key || equiposDisponibles[0]?.key || 'VISITA_DEFAULT');
    }
  }, [equiposDisponibles, equipoLocalKey, equipoVisitaKey]);

  const equipoLocal = equiposDisponibles.find((e) => e.key === equipoLocalKey) || equiposDisponibles[0] || null;
  const equipoVisita = equiposDisponibles.find((e) => e.key === equipoVisitaKey) || equiposDisponibles[1] || equiposDisponibles[0] || null;

  useEffect(() => {
    if (!equipoLocal) return;
    setLiveScore((prev) => ({
      ...prev,
      equipoLocalNombre: equipoLocal.nombre || prev.equipoLocalNombre,
      equipoLocalLogoUrl: equipoLocal.logoUrl || prev.equipoLocalLogoUrl,
      equipoVisitaNombre: modoAnalisis === 'dos' ? (equipoVisita?.nombre || prev.equipoVisitaNombre) : 'N/A',
      equipoVisitaLogoUrl: modoAnalisis === 'dos' ? (equipoVisita?.logoUrl || prev.equipoVisitaLogoUrl) : '',
    }));
  }, [equipoLocal, equipoVisita, modoAnalisis, setLiveScore]);

  const rosterFiltrado = useMemo(() => rosterNormalizado.filter((j) => {
    const okRama = filtroRama === 'Todas' || j._rama === filtroRama;
    const okCategoria = filtroCategoria === 'Todas' || j._categoria === filtroCategoria;
    const okCompeticion = filtroCompeticion === 'Todas' || j._competicion === filtroCompeticion;
    return okRama && okCategoria && okCompeticion;
  }), [rosterNormalizado, filtroRama, filtroCategoria, filtroCompeticion]);

  const rosterLocal = useMemo(
    () => rosterFiltrado.filter((j) => j._equipoKey === equipoLocalKey),
    [rosterFiltrado, equipoLocalKey]
  );

  const rosterVisita = useMemo(
    () => rosterFiltrado.filter((j) => j._equipoKey === equipoVisitaKey),
    [rosterFiltrado, equipoVisitaKey]
  );

  const ejecutarAccionFIBA = (tipo, puntos = 0) => {
    if (!jugadorSeleccionadoLive) return alert('Selecciona un jugador del Roster primero.');
    let nombreJugador = '';

    setRosterEquipo(rosterEquipo.map((j) => {
      if (j.id === jugadorSeleccionadoLive) {
        nombreJugador = `#${j.dorsal} ${j.nombre}`;
        return {
          ...j,
          pts: j.pts + puntos,
          reb: tipo === 'REB' ? j.reb + 1 : j.reb,
          ast: tipo === 'AST' ? j.ast + 1 : j.ast,
          stl: tipo === 'ROBO' ? j.stl + 1 : j.stl,
          flt: tipo === 'FALTA' ? j.flt + 1 : j.flt,
          to: tipo === 'PERDIDA' ? j.to + 1 : j.to,
        };
      }
      return j;
    }));

    if (puntos > 0) setLiveScore((prev) => ({ ...prev, ptsLocal: prev.ptsLocal + puntos }));
    if (tipo === 'FALTA') setLiveScore((prev) => ({ ...prev, faltasLocal: prev.faltasLocal + 1 }));

    const logTexto = puntos > 0 ? `${nombreJugador} anota ${puntos} pts` : `${nombreJugador} registra ${tipo}`;
    setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj, texto: logTexto }, ...prev]);
    setJugadorSeleccionadoLive(null);
  };

  const registrarPuntosVisita = (puntos = 1) => {
    if (modoAnalisis !== 'dos') return;
    const nombreEquipo = equipoVisita?.nombre || liveScore.equipoVisitaNombre || 'Visita';
    setLiveScore((prev) => ({ ...prev, ptsVisita: prev.ptsVisita + puntos }));
    setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj, texto: `${nombreEquipo} anota ${puntos} pts` }, ...prev]);
  };

  const registrarFaltaVisita = () => {
    if (modoAnalisis !== 'dos') return;
    const nombreEquipo = equipoVisita?.nombre || liveScore.equipoVisitaNombre || 'Visita';
    setLiveScore((prev) => ({ ...prev, faltasVisita: prev.faltasVisita + 1 }));
    setPlayByPlay((prev) => [{ id: nextId(), tiempo: liveScore.reloj, texto: `${nombreEquipo} registra FALTA` }, ...prev]);
  };

  if (modoChromaKey) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#00FF00', zIndex: 99999, display: 'flex', alignItems: 'flex-end', padding: '50px' }}>
        <div style={{ background: '#1C1C1E', border: '3px solid #333', borderRadius: '15px', padding: '20px 40px', display: 'flex', gap: '40px', alignItems: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
          <div className="text-center"><span style={{ color: '#aaa', fontSize: '14px', fontWeight: 'bold' }}>LOCAL {liveScore.flecha === 'LOCAL' && '◀'}</span><h1 style={{ color: 'white', margin: 0, fontSize: '60px', fontFamily: 'Orbitron' }}>{liveScore.ptsLocal}</h1><span style={{ color: '#FF3B30', fontSize: '12px', fontWeight: 'bold' }}>FALTAS: {liveScore.faltasLocal}</span></div>
          <div className="text-center"><span style={{ background: '#333', color: '#00FF00', padding: '10px 20px', borderRadius: '10px', fontSize: '24px', fontWeight: '900', fontFamily: 'Orbitron' }}>{liveScore.reloj}</span><h3 style={{ color: 'white', margin: '10px 0 0 0' }}>Q{liveScore.periodo}</h3></div>
          <div className="text-center"><span style={{ color: '#aaa', fontSize: '14px', fontWeight: 'bold' }}>{liveScore.flecha === 'VISITA' && '▶'} VISITA</span><h1 style={{ color: 'white', margin: 0, fontSize: '60px', fontFamily: 'Orbitron' }}>{liveScore.ptsVisita}</h1><span style={{ color: '#FF3B30', fontSize: '12px', fontWeight: 'bold' }}>FALTAS: {liveScore.faltasVisita}</span></div>
          <button style={{ position: 'absolute', top: '10px', right: '10px', background: 'black', color: 'white', border: 'none', padding: '10px', borderRadius: '999px', cursor: 'pointer', opacity: 0.2 }} onClick={() => setModoChromaKey(false)}>Cerrar Modo TV</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fiba-container fade-in">
      <div className="mesa-lab-header card mb-15">
        <div className="mesa-lab-title-wrap">
          <h3 className="form-subtitle" style={{ margin: 0 }}><Users size={18} color="#6B7280" strokeWidth={1.5} /> Mesa Insights</h3>
          <span className="mesa-lab-subtitle">Analiza uno o dos equipos con filtros competitivos y control live.</span>
        </div>
        <div className="mesa-lab-mode-switch" role="tablist" aria-label="Modo de análisis">
          <button className={`mesa-mode-btn ${modoAnalisis === 'uno' ? 'active' : ''}`} onClick={() => setModoAnalisis('uno')}>1 Equipo</button>
          <button className={`mesa-mode-btn ${modoAnalisis === 'dos' ? 'active' : ''}`} onClick={() => setModoAnalisis('dos')}>2 Equipos</button>
        </div>
      </div>

      <div className="mesa-filtros-grid card mb-15">
        <label className="mesa-filter-item">
          <span><Filter size={14} color="#6B7280" strokeWidth={1.5} /> Rama</span>
          <select className="form-input" value={filtroRama} onChange={(e) => setFiltroRama(e.target.value)}>
            {opcionesRama.map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
        </label>

        <label className="mesa-filter-item">
          <span><Filter size={14} color="#6B7280" strokeWidth={1.5} /> Categoría</span>
          <select className="form-input" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
            {opcionesCategoria.map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
        </label>

        <label className="mesa-filter-item">
          <span><Shield size={14} color="#6B7280" strokeWidth={1.5} /> Competición</span>
          <select className="form-input" value={filtroCompeticion} onChange={(e) => setFiltroCompeticion(e.target.value)}>
            {opcionesCompeticion.map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
        </label>

        <label className="mesa-filter-item">
          <span><Users size={14} color="#6B7280" strokeWidth={1.5} /> Equipo Local</span>
          <select className="form-input" value={equipoLocalKey} onChange={(e) => setEquipoLocalKey(e.target.value)}>
            {equiposDisponibles.map((e) => <option key={e.key} value={e.key}>{e.nombre}</option>)}
          </select>
        </label>

        {modoAnalisis === 'dos' && (
          <label className="mesa-filter-item">
            <span><Users size={14} color="#6B7280" strokeWidth={1.5} /> Equipo Visita</span>
            <select className="form-input" value={equipoVisitaKey} onChange={(e) => setEquipoVisitaKey(e.target.value)}>
              {equiposDisponibles.map((e) => <option key={e.key} value={e.key}>{e.nombre}</option>)}
            </select>
          </label>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button className="btn-secondary" style={{ width: 'auto', padding: '10px 15px', fontSize: '11px', gap: '5px', borderRadius: '999px' }} onClick={() => setModoChromaKey(true)}><Tv size={14} color="#6B7280" strokeWidth={1.5} /> Modo Transmisión (OBS)</button>
      </div>

      <div className="checkout-total-box mb-15" style={{ background: 'linear-gradient(180deg, #1C1C1E 0%, #101114 100%)', border: '2px solid rgba(0,122,255,0.2)', display: 'flex', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', padding: '20px 10px', borderRadius: '24px', boxShadow: '0 16px 34px rgba(15,23,42,0.12)' }}>
        <div className="text-center" style={{ flex: 1 }}>
          <span style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '800' }}>LOCAL {liveScore.flecha === 'LOCAL' && '◀'}</span>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', marginBottom: '4px' }}>
            <LogoAvatar nombre={liveScore.equipoLocalNombre || 'Centro de Cultura Física'} logoUrl={liveScore.equipoLocalLogoUrl} size={46} borderRadius="16px" />
          </div>
          <h1 style={{ fontSize: '52px', margin: 0, color: 'white', fontFamily: 'Orbitron' }}>{liveScore.ptsLocal}</h1>
          <span style={{ fontSize: '11px', color: '#FF3B30', fontWeight: '800', display: 'block' }}>FALTAS: {liveScore.faltasLocal}</span>
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', marginTop: '8px' }}>
            {[...Array(3)].map((_, i) => <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: i < liveScore.timeoutsLocal ? '#FFD700' : '#333' }}></div>)}
          </div>
        </div>

        <div className="text-center" style={{ flex: 1 }}>
          <span className="mesa-competicion-chip">{filtroCompeticion === 'Todas' ? 'Competición abierta' : filtroCompeticion}</span>
          <span style={{ fontSize: '16px', color: 'var(--verde-victoria)', fontWeight: '900', background: 'rgba(52,199,89,0.1)', padding: '8px 20px', borderRadius: '12px', border: '1px solid var(--verde-victoria)' }}>{liveScore.reloj}</span>
          <h4 style={{ margin: '10px 0 0 0', color: 'white', fontSize: '18px' }}>Q{liveScore.periodo}</h4>
        </div>

        <div className="text-center" style={{ flex: 1 }}>
          <span style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '800' }}>{liveScore.flecha === 'VISITA' && '▶'} VISITA</span>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', marginBottom: '4px' }}>
            <LogoAvatar nombre={liveScore.equipoVisitaNombre || 'Visitante'} logoUrl={liveScore.equipoVisitaLogoUrl} size={46} borderRadius="16px" />
          </div>
          <h1 style={{ fontSize: '52px', margin: 0, color: 'white', fontFamily: 'Orbitron' }}>{modoAnalisis === 'dos' ? liveScore.ptsVisita : '-'}</h1>
          <span style={{ fontSize: '11px', color: '#FF3B30', fontWeight: '800', display: 'block' }}>FALTAS: {liveScore.faltasVisita}</span>
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', marginTop: '8px' }}>
            {[...Array(3)].map((_, i) => <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: i < liveScore.timeoutsVisita ? '#FFD700' : '#333' }}></div>)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button className="btn-secondary" style={{ padding: '12px', fontSize: '12px', fontWeight: '800' }} onClick={() => setLiveScore({ ...liveScore, timeoutsLocal: Math.max(0, liveScore.timeoutsLocal - 1) })}>TM Local</button>
        <button className="btn-secondary" style={{ padding: '12px', fontSize: '12px', background: 'var(--azul-marino)', color: 'white' }} onClick={() => setLiveScore({ ...liveScore, flecha: liveScore.flecha === 'LOCAL' ? 'VISITA' : 'LOCAL' })}><ArrowRightLeft size={16} color="#6B7280" strokeWidth={1.5} /></button>
        <button className="btn-secondary" style={{ padding: '12px', fontSize: '12px', fontWeight: '800' }} onClick={() => setLiveScore({ ...liveScore, timeoutsVisita: Math.max(0, liveScore.timeoutsVisita - 1) })}>TM Visita</button>
      </div>

      <div className="caja-doble-grid landscape-mode">
        <div className="card" style={{ padding: '15px', borderRadius: '24px' }}>
          <h5 className="sub-caja-title">Roster Local ({rosterLocal.length})</h5>
          <div className="roster-fiba-list">
            {rosterLocal.map((j) => (
              <div key={j.id} onClick={() => setJugadorSeleccionadoLive(j.id)} className={`roster-fiba-item ${jugadorSeleccionadoLive === j.id ? 'seleccionado' : ''}`}>
                <div className="fiba-dorsal">#{j.dorsal}</div>
                <div className="fiba-info">
                  <strong>{j.nombre}</strong>
                  <span>{j.pts}pts | {j.flt}F | EFF: {calcularEff(j)}</span>
                </div>
              </div>
            ))}
            {rosterLocal.length === 0 && <p className="text-muted text-center" style={{ margin: '15px 0' }}>No hay jugadores para los filtros actuales.</p>}
          </div>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '24px' }}>
          <h5 className="sub-caja-title text-center" style={{ color: jugadorSeleccionadoLive ? 'var(--verde-victoria)' : '#FF3B30' }}>
            {jugadorSeleccionadoLive ? 'Control de Acciones' : 'Seleccione Jugador'}
          </h5>

          <div className="fiba-botones-grid">
            <button className="btn-fiba pt" disabled={!jugadorSeleccionadoLive} onClick={() => ejecutarAccionFIBA('PUNTO', 1)}>+1 TL</button>
            <button className="btn-fiba pt" disabled={!jugadorSeleccionadoLive} onClick={() => ejecutarAccionFIBA('PUNTO', 2)}>+2 PTS</button>
            <button className="btn-fiba pt" disabled={!jugadorSeleccionadoLive} onClick={() => ejecutarAccionFIBA('PUNTO', 3)}>+3 PTS</button>
            <button className="btn-fiba st" disabled={!jugadorSeleccionadoLive} onClick={() => ejecutarAccionFIBA('REB')}>REB</button>
            <button className="btn-fiba st" disabled={!jugadorSeleccionadoLive} onClick={() => ejecutarAccionFIBA('AST')}>AST</button>
            <button className="btn-fiba st" disabled={!jugadorSeleccionadoLive} onClick={() => ejecutarAccionFIBA('ROBO')}>ROBO</button>
            <button className="btn-fiba err" disabled={!jugadorSeleccionadoLive} onClick={() => ejecutarAccionFIBA('PERDIDA')}>PÉRDIDA</button>
            <button className="btn-fiba err" disabled={!jugadorSeleccionadoLive} onClick={() => ejecutarAccionFIBA('FALTA')}>FALTA</button>
          </div>

          {modoAnalisis === 'dos' && (
            <div className="mesa-visitor-actions">
              <h6>Acciones Rápidas Visita</h6>
              <div className="mesa-visitor-actions-grid">
                <button className="btn-secondary" onClick={() => registrarPuntosVisita(1)}>Visita +1</button>
                <button className="btn-secondary" onClick={() => registrarPuntosVisita(2)}>Visita +2</button>
                <button className="btn-secondary" onClick={() => registrarPuntosVisita(3)}>Visita +3</button>
                <button className="btn-secondary" onClick={registrarFaltaVisita}>Falta Visita</button>
              </div>
            </div>
          )}
        </div>

        {modoAnalisis === 'dos' && (
          <div className="card" style={{ padding: '15px', borderRadius: '24px' }}>
            <h5 className="sub-caja-title">Roster Visita ({rosterVisita.length})</h5>
            <div className="roster-fiba-list">
              {rosterVisita.map((j) => (
                <div key={j.id} className="roster-fiba-item">
                  <div className="fiba-dorsal">#{j.dorsal}</div>
                  <div className="fiba-info">
                    <strong>{j.nombre}</strong>
                    <span>{j.pts}pts | {j.flt}F | EFF: {calcularEff(j)}</span>
                  </div>
                </div>
              ))}
              {rosterVisita.length === 0 && <p className="text-muted text-center" style={{ margin: '15px 0' }}>Sin jugadores de visita para este filtro.</p>}
            </div>
          </div>
        )}
      </div>

      <div className="card mt-20" style={{ borderRadius: '24px' }}>
        <h4 className="form-subtitle" style={{ fontWeight: '900' }}><FileText size={16} color="#6B7280" strokeWidth={1.5} /> Línea de Tiempo (Play-by-Play)</h4>
        <div style={{ display: 'flex', gap: '10px' }} className="mb-15"><input type="text" className="form-input" placeholder="Nota táctica o scouting..." value={notaScouting} onChange={(e) => setNotaScouting(e.target.value)} /><button className="btn-electric" style={{ width: 'auto', padding: '0 20px' }} onClick={() => { if (!notaScouting) return; setPlayByPlay((prev) => [{ id: nextId(), tiempo: 'DT', texto: `📝 ${notaScouting}` }, ...prev]); setNotaScouting(''); }}>Log</button></div>
        <div className="play-by-play-box">{playByPlay.length === 0 ? <p className="text-center text-muted" style={{ fontSize: '13px', fontStyle: 'italic', margin: '20px 0' }}>Inicio de transmisión.</p> : playByPlay.map(play => (<div key={play.id} className="play-row"><span className="play-tiempo">{play.tiempo}</span><span className="play-texto">{play.texto}</span></div>))}</div>
      </div>
    </div>
  );
}

export default MesaControlPanel;

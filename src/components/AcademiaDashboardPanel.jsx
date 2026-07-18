import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Brain, Trophy } from 'lucide-react';
import { showToast } from '../utils/toast';
import * as api from '../api/client';

const normalizarNombreCompleto = (item = {}) => (
  `${item.nombres || ''} ${item.apellido_paterno || ''} ${item.apellido_materno || ''}`.trim() || 'Deportista'
);

function FiltroRamaCategoria({ jugadoresAdmin, filtroRama, setFiltroRama, filtroCategoria, setFiltroCategoria }) {
  const ramasDisponibles = useMemo(() => {
    const set = new Set((jugadoresAdmin || []).map((j) => String(j.rama || '').trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [jugadoresAdmin]);

  const categoriasDisponibles = useMemo(() => {
    const base = (jugadoresAdmin || []).filter((j) => filtroRama === 'Todas' || j.rama === filtroRama);
    const set = new Set(base.map((j) => String(j.categoria || '').trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [jugadoresAdmin, filtroRama]);

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }} className="mb-15">
      <select className="form-input" style={{ flex: 1, minWidth: '140px' }} value={filtroRama} onChange={(e) => { setFiltroRama(e.target.value); setFiltroCategoria('Todas'); }}>
        <option value="Todas">Todas las ramas</option>
        {ramasDisponibles.map((rama) => <option key={rama} value={rama}>{rama}</option>)}
      </select>
      <select className="form-input" style={{ flex: 1, minWidth: '140px' }} value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
        <option value="Todas">Todas las categorías</option>
        {categoriasDisponibles.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
      </select>
    </div>
  );
}

function TabRanking({ jugadoresAdmin }) {
  const [filtroRama, setFiltroRama] = useState('Todas');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [ranking, setRanking] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    api.academiaAPI.ranking({
      rama: filtroRama !== 'Todas' ? filtroRama : undefined,
      categoria: filtroCategoria !== 'Todas' ? filtroCategoria : undefined,
    })
      .then((datos) => { if (!cancelado) setRanking(Array.isArray(datos) ? datos : []); })
      .catch((error) => { if (!cancelado) showToast({ message: error.message || 'No se pudo cargar el ranking.', type: 'error' }); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [filtroRama, filtroCategoria]);

  return (
    <div>
      <FiltroRamaCategoria jugadoresAdmin={jugadoresAdmin} filtroRama={filtroRama} setFiltroRama={setFiltroRama} filtroCategoria={filtroCategoria} setFiltroCategoria={setFiltroCategoria} />
      {cargando && <p className="text-muted">Cargando ranking...</p>}
      {!cargando && ranking.length === 0 && <p className="text-muted text-center italic">Sin datos para este filtro.</p>}
      {!cargando && ranking.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {ranking.map((fila) => (
            <div key={fila.rut_jugador} style={{ display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid rgba(120,120,128,0.14)', borderRadius: '14px', padding: '10px 12px', background: 'rgba(255,255,255,0.84)' }}>
              <span style={{ fontSize: '13px', fontWeight: '900', color: 'var(--azul-electrico)', minWidth: '22px' }}>#{fila.posicion}</span>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '13px', display: 'block' }}>{normalizarNombreCompleto(fila)}</strong>
                <span style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>{fila.rama || 'General'} · {fila.categoria || '-'}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '13px', fontWeight: '800' }}>{fila.xp_total} XP</div>
                <div style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>Nivel {fila.nivel}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabQuizzes({ quizList }) {
  const [expandidoId, setExpandidoId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(false);

  const expandir = async (quiz) => {
    if (expandidoId === quiz.id) {
      setExpandidoId(null);
      setDetalle(null);
      return;
    }
    setExpandidoId(quiz.id);
    setCargando(true);
    try {
      const datos = await api.quizAPI.respuestas(quiz.id);
      setDetalle(datos);
    } catch (error) {
      showToast({ message: error.message || 'No se pudo cargar el detalle del quiz.', type: 'error' });
    } finally {
      setCargando(false);
    }
  };

  if ((quizList || []).length === 0) {
    return <p className="text-muted text-center italic">Todavía no hay quiz publicados.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {quizList.map((quiz) => {
        const abierto = expandidoId === quiz.id;
        return (
          <div key={quiz.id} style={{ border: '1px solid rgba(120,120,128,0.14)', borderRadius: '14px', padding: '10px 12px', background: 'rgba(255,255,255,0.84)' }}>
            <button
              type="button"
              onClick={() => expandir(quiz)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
            >
              <div>
                <strong style={{ fontSize: '13px', display: 'block' }}>{quiz.titulo}</strong>
                <span style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>{quiz.rama || 'General'} · {(Array.isArray(quiz.categorias_objetivo) && quiz.categorias_objetivo.length > 0) ? quiz.categorias_objetivo.join(', ') : 'Todas las categorías'}</span>
              </div>
              {abierto && detalle?.resumen && (
                <span style={{ fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '999px', background: 'rgba(0,122,255,0.1)', color: 'var(--azul-electrico)', whiteSpace: 'nowrap' }}>
                  {detalle.resumen.totalRespondieron}/{detalle.resumen.totalAudiencia} respondieron
                </span>
              )}
            </button>

            {abierto && (
              <div className="mt-10">
                {cargando && <p className="text-muted">Cargando...</p>}
                {!cargando && detalle && (
                  <>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '11px', fontWeight: '800', marginBottom: '8px' }}>
                      <span style={{ color: '#15803d' }}>{detalle.resumen.totalCorrectas} correctas</span>
                      <span style={{ color: '#b91c1c' }}>{detalle.resumen.totalIncorrectas} incorrectas</span>
                      <span style={{ color: 'var(--texto-secundario)' }}>{detalle.pendientes.length} pendientes</span>
                    </div>
                    {detalle.respuestas.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                        {detalle.respuestas.map((r) => (
                          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '4px 0', borderBottom: '1px solid rgba(120,120,128,0.08)' }}>
                            <span>{normalizarNombreCompleto(r)}</span>
                            <span style={{ fontWeight: '800', color: r.es_correcta ? '#15803d' : '#b91c1c' }}>{r.es_correcta ? 'Correcta' : 'Incorrecta'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {detalle.pendientes.length > 0 && (
                      <details>
                        <summary style={{ fontSize: '11px', fontWeight: '800', color: 'var(--texto-secundario)', cursor: 'pointer' }}>Ver pendientes ({detalle.pendientes.length})</summary>
                        <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {detalle.pendientes.map((j) => (
                            <span key={j.rut_jugador} style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>{normalizarNombreCompleto(j)}</span>
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TabMateriales({ materialesAcademia }) {
  const [expandidoId, setExpandidoId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(false);

  const expandir = async (material) => {
    if (expandidoId === material.id) {
      setExpandidoId(null);
      setDetalle(null);
      return;
    }
    setExpandidoId(material.id);
    setCargando(true);
    try {
      const datos = await api.academiaAPI.interacciones(material.id);
      setDetalle(datos);
    } catch (error) {
      showToast({ message: error.message || 'No se pudo cargar el detalle del material.', type: 'error' });
    } finally {
      setCargando(false);
    }
  };

  if ((materialesAcademia || []).length === 0) {
    return <p className="text-muted text-center italic">Todavía no hay materiales publicados.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {materialesAcademia.map((mat) => {
        const abierto = expandidoId === mat.id;
        return (
          <div key={mat.id} style={{ border: '1px solid rgba(120,120,128,0.14)', borderRadius: '14px', padding: '10px 12px', background: 'rgba(255,255,255,0.84)' }}>
            <button
              type="button"
              onClick={() => expandir(mat)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
            >
              <div>
                <strong style={{ fontSize: '13px', display: 'block' }}>{mat.TITULO}</strong>
                <span style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>{mat.rama || 'General'} · {(Array.isArray(mat.categorias_objetivo) && mat.categorias_objetivo.length > 0) ? mat.categorias_objetivo.join(', ') : 'Todas las categorías'}</span>
              </div>
              {abierto && detalle?.resumen && (
                <span style={{ fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '999px', background: 'rgba(0,122,255,0.1)', color: 'var(--azul-electrico)', whiteSpace: 'nowrap' }}>
                  {detalle.resumen.totalInteractuaron}/{detalle.resumen.totalAudiencia} interactuaron
                </span>
              )}
            </button>

            {abierto && (
              <div className="mt-10">
                {cargando && <p className="text-muted">Cargando...</p>}
                {!cargando && detalle && (
                  <>
                    {detalle.interacciones.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' }}>
                        {detalle.interacciones.map((i) => (
                          <span key={i.id} style={{ fontSize: '11px' }}>{normalizarNombreCompleto(i)}</span>
                        ))}
                      </div>
                    )}
                    {detalle.pendientes.length > 0 && (
                      <details>
                        <summary style={{ fontSize: '11px', fontWeight: '800', color: 'var(--texto-secundario)', cursor: 'pointer' }}>Ver pendientes ({detalle.pendientes.length})</summary>
                        <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {detalle.pendientes.map((j) => (
                            <span key={j.rut_jugador} style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>{normalizarNombreCompleto(j)}</span>
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AcademiaDashboardPanel({ jugadoresAdmin, quizList, materialesAcademia }) {
  const [subVista, setSubVista] = useState('ranking');

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', background: subVista === 'ranking' ? 'var(--azul-electrico)' : undefined, color: subVista === 'ranking' ? 'white' : undefined }} onClick={() => setSubVista('ranking')}>
          <Trophy size={13} /> Ranking
        </button>
        <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', background: subVista === 'quizzes' ? 'var(--azul-electrico)' : undefined, color: subVista === 'quizzes' ? 'white' : undefined }} onClick={() => setSubVista('quizzes')}>
          <Brain size={13} /> Quiz
        </button>
        <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', background: subVista === 'materiales' ? 'var(--azul-electrico)' : undefined, color: subVista === 'materiales' ? 'white' : undefined }} onClick={() => setSubVista('materiales')}>
          <BookOpen size={13} /> Materiales
        </button>
      </div>

      {subVista === 'ranking' && <TabRanking jugadoresAdmin={jugadoresAdmin} />}
      {subVista === 'quizzes' && <TabQuizzes quizList={quizList || []} />}
      {subVista === 'materiales' && <TabMateriales materialesAcademia={materialesAcademia || []} />}
    </div>
  );
}

export default AcademiaDashboardPanel;

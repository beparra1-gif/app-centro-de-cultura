import { useEffect, useMemo, useState } from 'react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';

const hoyISO = () => new Date().toISOString().slice(0, 10);

const inicioSemanaISO = () => {
  const d = new Date();
  const dia = d.getDay();
  const diff = dia === 0 ? 6 : dia - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
};

const inicioMesISO = (fecha = new Date()) => new Date(fecha.getFullYear(), fecha.getMonth(), 1).toISOString().slice(0, 10);

function CanchaEntrenamientosAnalisis() {
  const [analiticaDesde, setAnaliticaDesde] = useState(inicioMesISO());
  const [analiticaHasta, setAnaliticaHasta] = useState(hoyISO());
  const [analitica, setAnalitica] = useState([]);
  const [cargandoAnalitica, setCargandoAnalitica] = useState(false);

  useEffect(() => {
    (async () => {
      setCargandoAnalitica(true);
      try {
        const datos = await api.arriendosCanchaAPI.getAll({ desde: analiticaDesde, hasta: analiticaHasta });
        setAnalitica(Array.isArray(datos) ? datos : []);
      } catch (error) {
        showToast({ message: error.message || 'No se pudo cargar el análisis.', type: 'error' });
        setAnalitica([]);
      } finally {
        setCargandoAnalitica(false);
      }
    })();
  }, [analiticaDesde, analiticaHasta]);

  const totalRecaudado = analitica.filter((a) => a.estado_pago !== 'anulado').reduce((acc, a) => acc + Number(a.monto_pagado || 0), 0);
  const totalPendiente = analitica
    .filter((a) => a.estado_pago === 'pendiente' || a.estado_pago === 'parcial')
    .reduce((acc, a) => acc + Math.max(0, Number(a.valor_arriendo || 0) - Number(a.monto_pagado || 0)), 0);
  const cantidadReservas = analitica.filter((a) => a.estado_pago !== 'anulado').length;
  const horasArrendadas = analitica
    .filter((a) => a.estado_pago !== 'anulado')
    .reduce((acc, a) => {
      const [hIni, mIni] = String(a.hora_inicio || '0:0').split(':').map(Number);
      const [hFin, mFin] = String(a.hora_fin || '0:0').split(':').map(Number);
      return acc + Math.max(0, (hFin * 60 + mFin - (hIni * 60 + mIni)) / 60);
    }, 0);
  const rankingArrendatarios = useMemo(() => {
    const mapa = new Map();
    analitica.filter((a) => a.estado_pago !== 'anulado').forEach((a) => {
      const key = a.nombre_arrendatario;
      mapa.set(key, (mapa.get(key) || 0) + 1);
    });
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [analitica]);

  return (
    <div className="fade-in">
      <div className="card mb-15" style={{ borderRadius: '18px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <button className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', fontSize: '12px' }} onClick={() => { setAnaliticaDesde(hoyISO()); setAnaliticaHasta(hoyISO()); }}>Hoy</button>
          <button className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', fontSize: '12px' }} onClick={() => { setAnaliticaDesde(inicioSemanaISO()); setAnaliticaHasta(hoyISO()); }}>Esta semana</button>
          <button className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', fontSize: '12px' }} onClick={() => { setAnaliticaDesde(inicioMesISO()); setAnaliticaHasta(hoyISO()); }}>Este mes</button>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" className="form-input" style={{ maxWidth: '160px' }} value={analiticaDesde} onChange={(e) => setAnaliticaDesde(e.target.value)} />
          <span>a</span>
          <input type="date" className="form-input" style={{ maxWidth: '160px' }} value={analiticaHasta} onChange={(e) => setAnaliticaHasta(e.target.value)} />
        </div>
      </div>

      {cargandoAnalitica && <p className="text-muted">Calculando...</p>}

      {!cargandoAnalitica && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginBottom: '15px' }}>
            <div className="admin-stat-pill verde"><span>Recaudado</span><h2>${totalRecaudado.toLocaleString('es-CL')}</h2></div>
            <div className="admin-stat-pill" style={{ background: 'rgba(255,149,0,0.1)' }}><span>Pendiente de cobro</span><h2 style={{ color: '#b36200' }}>${totalPendiente.toLocaleString('es-CL')}</h2></div>
            <div className="admin-stat-pill azul"><span>Reservas</span><h2>{cantidadReservas}</h2></div>
            <div className="admin-stat-pill azul"><span>Horas arrendadas</span><h2>{horasArrendadas.toFixed(1)}</h2></div>
          </div>

          <h4 className="form-subtitle">Arrendatarios frecuentes</h4>
          {rankingArrendatarios.length === 0 && (
            <p className="text-muted italic">Sin datos en el período seleccionado.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {rankingArrendatarios.map(([nombre, cantidad]) => (
              <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid var(--borde-suave)', borderRadius: '12px', padding: '8px 12px', fontSize: '13px' }}>
                <span>{nombre}</span>
                <strong>{cantidad} {cantidad === 1 ? 'reserva' : 'reservas'}</strong>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default CanchaEntrenamientosAnalisis;

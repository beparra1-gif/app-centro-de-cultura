import * as api from '../api/client';
import { getColorUrgencia } from '../utils/appHelpers';

function ComunicacionFormPanel({
  formCom,
  setFormCom,
  comunicaciones,
  setComunicaciones,
  setMostrarFormComunicaciones,
  addNotificacionHistorial,
}) {
  const agregarComunicacion = async () => {
    try {
      const nuevaCom = await api.comunicacionesAPI.create({
        titulo: formCom.titulo,
        cuerpo_texto: formCom.mensaje,
        tipo: formCom.tipo,
        rama: formCom.rama,
        categoria: formCom.categoria,
        urgencia: formCom.urgencia,
        solicita_asistencia: formCom.solicita_asistencia,
      });

      setComunicaciones([
        {
          id: nuevaCom.id,
          TITULO: nuevaCom.titulo,
          CUERPO_TEXTO: nuevaCom.cuerpo_texto,
          FECHA: new Date(nuevaCom.created_at).toLocaleDateString('es-CL'),
          TIPO_COMUNICADO: nuevaCom.tipo,
          rama: nuevaCom.rama,
          categoria: nuevaCom.categoria,
          urgencia: nuevaCom.urgencia,
          solicita_asistencia: nuevaCom.solicita_asistencia,
          reacciones: nuevaCom.reacciones || {},
          asistencias: nuevaCom.asistencias || [],
        },
        ...comunicaciones,
      ]);

      const tituloActual = formCom.titulo;
      setFormCom({ titulo: '', mensaje: '', audiencia: ['deportistas'], rama: 'General', categoria: 'General', tipo: 'Aviso', urgencia: 'Media', solicita_asistencia: false });
      setMostrarFormComunicaciones(false);
      addNotificacionHistorial('comunicacion', 'Nueva Comunicacion', `"${tituloActual}" publicada correctamente`);
    } catch (error) {
      console.error('Error agregando comunicacion:', error);
      alert('Error al crear la comunicacion');
    }
  };

  const toggleAudiencia = (aud) => {
    const nuevaAudiencia = formCom.audiencia.includes(aud)
      ? formCom.audiencia.filter(a => a !== aud)
      : [...formCom.audiencia, aud];
    setFormCom({ ...formCom, audiencia: nuevaAudiencia });
  };

  return (
    <div className="card mt-20 fade-in" style={{ background: 'linear-gradient(180deg, rgba(0, 122, 255, 0.06), rgba(52, 199, 89, 0.05))', border: '1px solid rgba(255,255,255,0.72)', borderRadius: '24px', boxShadow: '0 14px 34px rgba(15,23,42,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', gap: '8px', flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0, color: 'var(--texto-heading)', fontSize: '18px', fontWeight: '800' }}>Nueva Comunicacion</h4>
        <button onClick={() => setMostrarFormComunicaciones(false)} style={{ background: 'rgba(120,120,128,0.10)', border: 'none', fontSize: '20px', cursor: 'pointer', width: '34px', height: '34px', borderRadius: '999px' }}>✕</button>
      </div>

      <input type="text" placeholder="Titulo de la comunicacion" value={formCom.titulo} onChange={e => setFormCom({ ...formCom, titulo: e.target.value })} className="form-input mb-10" style={{ width: '100%', padding: '12px', borderRadius: '16px', border: '1px solid var(--borde-suave)', fontSize: '14px', background: 'rgba(255,255,255,0.92)' }} />

      <textarea placeholder="Mensaje/Descripcion" value={formCom.mensaje} onChange={e => setFormCom({ ...formCom, mensaje: e.target.value })} className="form-input mb-10" style={{ width: '100%', padding: '12px', borderRadius: '16px', border: '1px solid var(--borde-suave)', minHeight: '80px', fontSize: '14px', resize: 'vertical', background: 'rgba(255,255,255,0.92)' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
        <select value={formCom.tipo} onChange={e => setFormCom({ ...formCom, tipo: e.target.value })} className="form-input" style={{ padding: '10px', borderRadius: '14px', border: '1px solid var(--borde-suave)', fontSize: '13px', background: 'rgba(255,255,255,0.92)' }}>
          <option>Aviso</option>
          <option>Evento</option>
          <option>Suspension</option>
          <option>Asamblea</option>
          <option>Rendimiento</option>
          <option>Tesoreria</option>
        </select>
        <select value={formCom.urgencia} onChange={e => setFormCom({ ...formCom, urgencia: e.target.value })} className="form-input" style={{ padding: '10px', borderRadius: '14px', border: '1px solid var(--borde-suave)', fontSize: '13px', borderLeft: `4px solid ${getColorUrgencia(formCom.urgencia)}`, background: 'rgba(255,255,255,0.92)' }}>
          <option>Baja</option>
          <option>Media</option>
          <option>Alta</option>
          <option>Critica</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
        <select value={formCom.rama} onChange={e => setFormCom({ ...formCom, rama: e.target.value })} className="form-input" style={{ padding: '10px', borderRadius: '14px', border: '1px solid var(--borde-suave)', fontSize: '13px', background: 'rgba(255,255,255,0.92)' }}>
          <option>General</option>
          <option>Femenina</option>
          <option>Masculina</option>
        </select>
        <select value={formCom.categoria} onChange={e => setFormCom({ ...formCom, categoria: e.target.value })} className="form-input" style={{ padding: '10px', borderRadius: '14px', border: '1px solid var(--borde-suave)', fontSize: '13px', background: 'rgba(255,255,255,0.92)' }}>
          <option>General</option>
          <option>U13</option>
          <option>U15</option>
          <option>U17</option>
          <option>Adultos</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '15px' }}>
        {['socios', 'apoderados', 'deportistas'].map(aud => (
          <button key={aud} onClick={() => toggleAudiencia(aud)} style={{ padding: '10px', borderRadius: '14px', background: formCom.audiencia.includes(aud) ? 'linear-gradient(180deg, #2f8cff 0%, var(--azul-electrico) 100%)' : 'rgba(255,255,255,0.92)', color: formCom.audiencia.includes(aud) ? 'white' : 'var(--texto-principal)', border: formCom.audiencia.includes(aud) ? 'none' : '1px solid var(--borde-suave)', cursor: 'pointer', fontSize: '13px', fontWeight: formCom.audiencia.includes(aud) ? '700' : '500', transition: '0.2s' }}>
            {aud === 'socios' ? 'Socios' : aud === 'apoderados' ? 'Apoderados' : 'Deportistas'}
          </button>
        ))}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', cursor: 'pointer', fontSize: '13px' }}>
        <input type="checkbox" checked={formCom.solicita_asistencia} onChange={e => setFormCom({ ...formCom, solicita_asistencia: e.target.checked })} style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
        <span>Solicitar asistencia / RSVP</span>
      </label>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={agregarComunicacion} className="btn-electric" style={{ flex: 1, padding: '12px', borderRadius: '16px', border: 'none', color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
          Publicar
        </button>
        <button onClick={() => setMostrarFormComunicaciones(false)} className="btn-secondary" style={{ flex: 1, padding: '12px', borderRadius: '16px', border: '1px solid var(--borde-suave)', background: 'rgba(255,255,255,0.92)', color: 'var(--texto-principal)', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default ComunicacionFormPanel;

import { X } from 'lucide-react';

function SearchPanel({
  busquedaGlobal,
  setBusquedaGlobal,
  buscarGlobal,
  resultadosBusqueda,
  setMostrarBusqueda,
}) {
  return (
    <div className="card fade-in" style={{ background: 'linear-gradient(180deg, rgba(0, 122, 255, 0.06), rgba(52, 199, 89, 0.05))', marginBottom: '20px', borderRadius: '24px', boxShadow: '0 14px 34px rgba(15,23,42,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, color: 'var(--texto-heading)', fontSize: '16px', fontWeight: '700' }}>Busqueda Global</h4>
        <button onClick={() => setMostrarBusqueda(false)} style={{ background: 'rgba(120,120,128,0.10)', border: 'none', cursor: 'pointer', width: '34px', height: '34px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Cerrar"><X size={16} /></button>
      </div>

      <input
        type="text"
        placeholder="Buscar comunicaciones, comentarios, usuarios..."
        value={busquedaGlobal}
        onChange={e => {
          setBusquedaGlobal(e.target.value);
          buscarGlobal(e.target.value);
        }}
        style={{ width: '100%', padding: '12px', borderRadius: '16px', border: '1px solid var(--borde-suave)', marginBottom: '12px', fontSize: '13px', background: 'rgba(255,255,255,0.9)' }}
      />

      {resultadosBusqueda.comunicaciones.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <h6 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '700', color: 'var(--azul-electrico)' }}>Comunicaciones ({resultadosBusqueda.comunicaciones.length})</h6>
          {resultadosBusqueda.comunicaciones.map(c => (
            <button type="button" key={c.id} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'rgba(0,0,0,0.02)', border: 'none', fontFamily: 'inherit', padding: '10px', borderRadius: '14px', marginBottom: '6px', fontSize: '12px', cursor: 'pointer' }} onClick={() => setMostrarBusqueda(false)}>
              <strong>{c.TITULO}</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--texto-secundario)' }}>{c.CUERPO_TEXTO.substring(0, 60)}...</p>
            </button>
          ))}
        </div>
      )}

      {resultadosBusqueda.comentarios.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <h6 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '700', color: 'var(--azul-electrico)' }}>Comentarios ({resultadosBusqueda.comentarios.length})</h6>
          {resultadosBusqueda.comentarios.slice(0, 3).map((c, i) => (
            <button type="button" key={i} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'rgba(0,0,0,0.02)', border: 'none', fontFamily: 'inherit', padding: '10px', borderRadius: '14px', marginBottom: '6px', fontSize: '12px', cursor: 'pointer' }} onClick={() => setMostrarBusqueda(false)}>
              <strong>{c.usuario}</strong> {c.esRespuesta && '(respuesta)'}
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--texto-secundario)' }}>{c.texto.substring(0, 60)}...</p>
            </button>
          ))}
        </div>
      )}

      {resultadosBusqueda.usuarios.length > 0 && (
        <div>
          <h6 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '700', color: 'var(--azul-electrico)' }}>Usuarios ({resultadosBusqueda.usuarios.length})</h6>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {resultadosBusqueda.usuarios.map(u => (
              <span key={u} style={{ background: 'linear-gradient(180deg, #2f8cff 0%, var(--azul-electrico) 100%)', color: 'white', padding: '5px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '700' }}>@{u}</span>
            ))}
          </div>
        </div>
      )}

      {busquedaGlobal.trim() && resultadosBusqueda.comunicaciones.length === 0 && resultadosBusqueda.comentarios.length === 0 && resultadosBusqueda.usuarios.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--texto-secundario)', fontSize: '12px', margin: 0 }}>Sin resultados para "{busquedaGlobal}"</p>
      )}
    </div>
  );
}

export default SearchPanel;

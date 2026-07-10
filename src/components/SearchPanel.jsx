function SearchPanel({
  busquedaGlobal,
  setBusquedaGlobal,
  buscarGlobal,
  resultadosBusqueda,
  setMostrarBusqueda,
}) {
  return (
    <div className="card fade-in" style={{ background: 'linear-gradient(135deg, rgba(0, 122, 255, 0.05), rgba(52, 199, 89, 0.05))', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, color: 'var(--texto-heading)', fontSize: '16px', fontWeight: '700' }}>Busqueda Global</h4>
        <button onClick={() => setMostrarBusqueda(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
      </div>

      <input
        type="text"
        placeholder="Buscar comunicaciones, comentarios, usuarios..."
        value={busquedaGlobal}
        onChange={e => {
          setBusquedaGlobal(e.target.value);
          buscarGlobal(e.target.value);
        }}
        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--borde-suave)', marginBottom: '12px', fontSize: '13px' }}
      />

      {resultadosBusqueda.comunicaciones.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <h6 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '700', color: 'var(--azul-electrico)' }}>Comunicaciones ({resultadosBusqueda.comunicaciones.length})</h6>
          {resultadosBusqueda.comunicaciones.map(c => (
            <div key={c.id} style={{ background: 'rgba(0,0,0,0.02)', padding: '8px', borderRadius: '4px', marginBottom: '6px', fontSize: '12px', cursor: 'pointer' }} onClick={() => setMostrarBusqueda(false)}>
              <strong>{c.TITULO}</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--texto-secundario)' }}>{c.CUERPO_TEXTO.substring(0, 60)}...</p>
            </div>
          ))}
        </div>
      )}

      {resultadosBusqueda.comentarios.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <h6 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '700', color: 'var(--azul-electrico)' }}>Comentarios ({resultadosBusqueda.comentarios.length})</h6>
          {resultadosBusqueda.comentarios.slice(0, 3).map((c, i) => (
            <div key={i} style={{ background: 'rgba(0,0,0,0.02)', padding: '8px', borderRadius: '4px', marginBottom: '6px', fontSize: '12px', cursor: 'pointer' }} onClick={() => setMostrarBusqueda(false)}>
              <strong>{c.usuario}</strong> {c.esRespuesta && '(respuesta)'}
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--texto-secundario)' }}>{c.texto.substring(0, 60)}...</p>
            </div>
          ))}
        </div>
      )}

      {resultadosBusqueda.usuarios.length > 0 && (
        <div>
          <h6 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '700', color: 'var(--azul-electrico)' }}>Usuarios ({resultadosBusqueda.usuarios.length})</h6>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {resultadosBusqueda.usuarios.map(u => (
              <span key={u} style={{ background: 'var(--azul-electrico)', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>@{u}</span>
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

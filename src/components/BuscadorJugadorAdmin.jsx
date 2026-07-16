import { useMemo, useState } from 'react';
import { Search, User, X } from 'lucide-react';

const normalizarTexto = (texto = '') => String(texto || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '');

const LISTA_VACIA = [];

function BuscadorJugadorAdmin({ jugadores, pupiloActivo, onSeleccionar }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroRama, setFiltroRama] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  const lista = Array.isArray(jugadores) ? jugadores : LISTA_VACIA;

  // La data trae variantes de mayus/minus para el mismo valor (ej. "MASCULINA"
  // y "masculina"); se agrupan por valor normalizado para no listarlas como
  // opciones separadas, mostrando la primera forma encontrada.
  const agruparValoresUnicos = (valores) => {
    const vistos = new Map();
    valores.filter(Boolean).forEach((valor) => {
      const clave = normalizarTexto(valor);
      if (!vistos.has(clave)) vistos.set(clave, valor);
    });
    return Array.from(vistos.values()).sort((a, b) => a.localeCompare(b));
  };

  const ramas = useMemo(() => agruparValoresUnicos(lista.map((j) => j.rama)), [lista]);
  const categorias = useMemo(() => agruparValoresUnicos(lista.map((j) => j.categoria)), [lista]);

  const resultados = useMemo(() => {
    const termino = normalizarTexto(busqueda);
    return lista
      .filter((j) => {
        if (filtroRama && normalizarTexto(j.rama) !== normalizarTexto(filtroRama)) return false;
        if (filtroCategoria && normalizarTexto(j.categoria) !== normalizarTexto(filtroCategoria)) return false;
        if (termino.length >= 2 && !normalizarTexto(j.nombre).includes(termino)) return false;
        return true;
      })
      .slice(0, 30);
  }, [lista, busqueda, filtroRama, filtroCategoria]);

  const mostrarResultados = busqueda.trim().length >= 2 || filtroRama || filtroCategoria;

  return (
    <div className="card mb-15" style={{ borderRadius: '18px', padding: '14px' }}>
      <label style={{ fontSize: '12px', fontWeight: '900', display: 'block', marginBottom: '8px' }}>
        Buscar jugador
      </label>
      <div style={{ position: 'relative', marginBottom: '10px' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-secundario)' }} />
        <input
          type="text"
          className="form-input"
          style={{ paddingLeft: '36px', paddingRight: busqueda ? '36px' : undefined }}
          placeholder="Nombre del jugador..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {busqueda && (
          <button
            type="button"
            onClick={() => setBusqueda('')}
            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-secundario)', padding: '4px' }}
            aria-label="Limpiar búsqueda"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <select className="form-input" value={filtroRama} onChange={(e) => setFiltroRama(e.target.value)}>
          <option value="">Todas las ramas</option>
          {ramas.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="form-input" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {mostrarResultados && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
          {resultados.length === 0 && (
            <p style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '700', margin: 0 }}>Sin resultados.</p>
          )}
          {resultados.map((j) => (
            <button
              type="button"
              key={j.id}
              onClick={() => onSeleccionar(j)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '14px',
                border: pupiloActivo?.id === j.id ? '1px solid var(--azul-electrico)' : '1px solid var(--borde-suave)',
                background: pupiloActivo?.id === j.id ? 'rgba(0,122,255,0.08)' : 'rgba(0,122,255,0.03)',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <User size={18} color="var(--azul-electrico)" />
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: '13px', color: 'var(--texto-principal)' }}>{j.nombre}</strong>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                  {j.rama || 'General'} · {j.categoria || 'General'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default BuscadorJugadorAdmin;

import { useMemo, useState } from 'react';
import SelectorOrden from './SelectorOrden';
import usePreferenciaLocal, { esOrdenValido } from '../utils/usePreferenciaLocal';
import { ordenarPersonas } from '../utils/ordenarPersonas';
import { ordenarCategorias } from '../utils/informeDeuda';
import { Bell, ChevronDown, Eye, Phone, Plus, Search, User, Users, X } from 'lucide-react';
import { filtrarCuentasQuePagan, resumirCuentasQuePagan } from '../utils/tesoreriaCuentas';

// Tesorería → "Por cobrar": una fila por cada persona que paga alguna cuota
// (socio, apoderado, deportista que se autogestiona, directiva o staff que
// además sea socio/apoderado), con cada concepto por separado: cuota de
// socio y mensualidad de cada pupilo. Desde cada línea se registra el pago
// de ESE concepto (super admin) y desde la fila se abre la cuenta familiar.

const PASO_PAGINA = 30;
const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;

const FILTROS_ESTADO = [
  { id: 'con_deuda', label: 'Con deuda' },
  { id: 'al_dia', label: 'Al día' },
  { id: 'todas', label: 'Todas' },
];
const FILTROS_PERFIL = [
  { id: 'todos', label: 'Todos' },
  { id: 'socios', label: 'Socios' },
  { id: 'apoderados', label: 'Apoderados' },
  { id: 'autogestionados', label: 'Deportistas que pagan' },
  { id: 'sin_responsable', label: 'Sin responsable' },
];

function LineaConcepto({ titulo, detalle, deuda, mesesMorosos, chips = [], onPagar, puedePagar }) {
  const debe = deuda > 0;
  return (
    <div className={`tc-linea ${debe ? 'tc-linea-debe' : 'tc-linea-ok'}`}>
      <div className="tc-linea-texto">
        <span className="tc-linea-titulo">{titulo}</span>
        {detalle && <span className="tc-linea-detalle">{detalle}</span>}
        {chips.map((c) => <span key={c} className="tc-chip-mini">{c}</span>)}
        {debe && mesesMorosos.length > 0 && (
          <span className="tc-meses">{mesesMorosos.join(' · ')}</span>
        )}
      </div>
      <span className={`tc-estado ${debe ? 'debe' : 'ok'}`}>{debe ? pesos(deuda) : 'Al día'}</span>
      {puedePagar && (
        <button type="button" className="tc-btn-pagar" onClick={onPagar} title={`Registrar pago de ${titulo}`}>
          <Plus size={13} /> Pago
        </button>
      )}
    </div>
  );
}

export default function TesoreriaCuentasPanel({
  filas = [],
  puedeRegistrarPago = false,
  onRegistrarPago,
  onVerCuenta,
  onAvisar,
  onNotificarTodos,
  onRecordarEnApp,
  ultimoRecordatorio = null,
}) {
  const [texto, setTexto] = useState('');
  // Se recuerdan en este dispositivo (la búsqueda no).
  const [estado, setEstado] = usePreferenciaLocal('porCobrar.estado', 'con_deuda', (v) => typeof v === 'string');
  const [perfil, setPerfil] = usePreferenciaLocal('porCobrar.perfil', 'todos', (v) => typeof v === 'string');
  const [rama, setRama] = usePreferenciaLocal('porCobrar.rama', 'todas', (v) => typeof v === 'string');
  const [limite, setLimite] = useState(PASO_PAGINA);
  const [orden, setOrden] = usePreferenciaLocal('porCobrar.orden', { orden: 'deuda', dir: 'desc' }, esOrdenValido(['deuda', 'apellido', 'nombre', 'categoria']));

  const ramas = useMemo(() => (
    [...new Set(filas.flatMap((f) => f.pupilos.map((p) => p.rama)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
  ), [filas]);
  const resumen = useMemo(() => resumirCuentasQuePagan(filas), [filas]);
  const filtradas = useMemo(
    () => ordenarPersonas(filtrarCuentasQuePagan(filas, { texto, estado, perfil, rama }), orden, (f) => {
      const persona = f.cuenta || f.pupilos[0]?.jugador || {};
      // Categoría de una familia: la menor de sus deportistas.
      const categorias = f.pupilos.map((p) => p.categoria).filter(Boolean).sort(ordenarCategorias);
      return {
        nombre: persona.nombres || f.nombre,
        apellido: `${persona.apellido_paterno || ''} ${persona.apellido_materno || ''}`.trim(),
        categoria: categorias[0] || '',
        deuda: f.deudaTotal,
      };
    }),
    [filas, texto, estado, perfil, rama, orden]
  );
  const visibles = filtradas.slice(0, limite);
  const cambiar = (setter) => (valor) => { setter(valor); setLimite(PASO_PAGINA); };

  return (
    <div className="fade-in">
      <div className="tc-resumen">
        <div className="tc-resumen-item tc-resumen-total">
          <span>Por cobrar</span>
          <strong>{pesos(resumen.total)}</strong>
          <small>{resumen.conDeuda} {resumen.conDeuda === 1 ? 'persona con deuda' : 'personas con deuda'}</small>
        </div>
        <div className="tc-resumen-item">
          <span>Cuotas de socio</span>
          <strong>{pesos(resumen.socios)}</strong>
        </div>
        <div className="tc-resumen-item">
          <span>Mensualidades</span>
          <strong>{pesos(resumen.deportistas)}</strong>
        </div>
      </div>

      <div className="tc-buscador">
        <Search size={16} className="tc-buscador-icono" />
        <input
          type="search"
          className="form-input"
          placeholder="Buscar socio, apoderado, deportista, RUT o teléfono…"
          aria-label="Buscar en Tesorería"
          value={texto}
          onChange={(e) => cambiar(setTexto)(e.target.value)}
        />
        {texto && (
          <button type="button" className="tc-buscador-limpiar" onClick={() => cambiar(setTexto)('')} aria-label="Limpiar búsqueda">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="filter-chips mb-10" role="group" aria-label="Estado de pago">
        {FILTROS_ESTADO.map((f) => (
          <button key={f.id} type="button" className={`filter-chip ${estado === f.id ? 'active' : ''}`} onClick={() => cambiar(setEstado)(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="tc-filtros-fila">
        <div className="filter-chips" role="group" aria-label="Perfil">
          {FILTROS_PERFIL.map((f) => (
            <button key={f.id} type="button" className={`filter-chip ${perfil === f.id ? 'active' : ''}`} onClick={() => cambiar(setPerfil)(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <SelectorOrden valor={orden} onCambiar={cambiar(setOrden)} opciones={['deuda', 'apellido', 'nombre', 'categoria']} />
        {ramas.length > 1 && (
          <select className="form-input tc-select-rama" value={rama} onChange={(e) => cambiar(setRama)(e.target.value)} aria-label="Rama">
            <option value="todas">Todas las ramas</option>
            {ramas.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
      </div>

      <div className="tc-barra-lista">
        <span>{filtradas.length} {filtradas.length === 1 ? 'resultado' : 'resultados'}</span>
        <div className="tc-barra-botones">
          {onRecordarEnApp && filtradas.some((f) => f.deudaTotal > 0 && f.tipo === 'cuenta') && (
            <button
              type="button"
              className="btn-notificar"
              onClick={() => onRecordarEnApp(filtradas.filter((f) => f.deudaTotal > 0 && f.tipo === 'cuenta'))}
            >
              <Bell size={13} /> Recordar en la app
            </button>
          )}
          {onNotificarTodos && filtradas.some((f) => f.deudaTotal > 0 && f.telefono) && (
            <button type="button" className="btn-notificar" onClick={() => onNotificarTodos(filtradas.filter((f) => f.deudaTotal > 0))}>
              <Phone size={13} /> WhatsApp a esta lista
            </button>
          )}
        </div>
      </div>

      {ultimoRecordatorio?.ultimoEnvio && (
        <p className="tc-nota">Último recordatorio en la app: {new Date(ultimoRecordatorio.ultimoEnvio).toLocaleDateString('es-CL')} ({ultimoRecordatorio.enviados || 0} familias).</p>
      )}

      {filtradas.length === 0 && (
        <p className="tc-vacio">
          {estado === 'con_deuda' && !texto ? 'Nadie tiene cuotas pendientes con estos filtros. 🎉' : 'Sin resultados para esta búsqueda.'}
        </p>
      )}

      <div className="tc-lista">
        {visibles.map((f) => (
          <article key={f.id} className={`tc-fila ${f.deudaTotal > 0 ? 'tc-fila-debe' : ''}`}>
            <header className="tc-fila-header">
              <div className="tc-fila-titulo">
                <span className="tc-avatar" aria-hidden="true">{f.tipo === 'sin_responsable' ? <User size={16} /> : <Users size={16} />}</span>
                <div style={{ minWidth: 0 }}>
                  <h4>{f.nombre}</h4>
                  <div className="tc-perfiles">
                    {f.perfiles.map((p) => (
                      <span key={p} className={`tc-perfil ${p === 'Sin responsable de pago' ? 'alerta' : ''}`}>{p}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="tc-fila-total">
                <strong className={f.deudaTotal > 0 ? 'debe' : 'ok'}>{f.deudaTotal > 0 ? pesos(f.deudaTotal) : 'Al día'}</strong>
                {f.mesesDeudaTotal > 0 && <small>{f.mesesDeudaTotal} {f.mesesDeudaTotal === 1 ? 'cuota' : 'cuotas'}</small>}
              </div>
            </header>

            <div className="tc-lineas">
              {f.socio && (
                <LineaConcepto
                  titulo="Cuota de socio"
                  deuda={f.socio.deuda}
                  mesesMorosos={f.socio.mesesMorosos}
                  puedePagar={puedeRegistrarPago}
                  onPagar={() => onRegistrarPago?.({ modoPago: 'socio', rut: f.rut })}
                />
              )}
              {f.pupilos.map((p) => {
                const chips = [];
                if (p.exento) chips.push('Exento');
                else if (p.beca > 0) chips.push(`Beca ${p.beca}%`);
                return (
                  <LineaConcepto
                    key={p.clave}
                    titulo={p.autogestionado ? 'Su mensualidad' : p.nombre}
                    detalle={[p.rama, p.categoria].filter(Boolean).join(' · ')}
                    chips={chips}
                    deuda={p.deuda}
                    mesesMorosos={p.mesesMorosos}
                    puedePagar={puedeRegistrarPago}
                    onPagar={() => onRegistrarPago?.({ modoPago: 'deportista', rut: p.rut })}
                  />
                );
              })}
            </div>

            <footer className="tc-fila-acciones">
              <span className="tc-contacto">
                {f.telefono ? <><Phone size={12} /> {f.telefono}</> : (f.correo || 'Sin contacto')}
              </span>
              <div className="tc-fila-botones">
                {f.deudaTotal > 0 && onAvisar && (
                  <button
                    type="button"
                    className="btn-secondary tc-btn"
                    disabled={!f.telefono}
                    title={f.telefono ? `Recordatorio por WhatsApp a ${f.telefono}` : 'Sin teléfono registrado'}
                    onClick={() => onAvisar(f)}
                  >
                    <Bell size={13} /> Avisar
                  </button>
                )}
                <button type="button" className="btn-secondary tc-btn" onClick={() => onVerCuenta?.(f)}>
                  <Eye size={13} /> Ver cuenta
                </button>
              </div>
            </footer>
          </article>
        ))}
      </div>

      {filtradas.length > limite && (
        <button type="button" className="btn-secondary tc-ver-mas" onClick={() => setLimite((n) => n + PASO_PAGINA)}>
          <ChevronDown size={14} /> Ver {Math.min(PASO_PAGINA, filtradas.length - limite)} más ({filtradas.length - limite} restantes)
        </button>
      )}
    </div>
  );
}

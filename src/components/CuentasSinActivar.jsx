import { useEffect, useMemo, useState } from 'react';
import { Check, KeyRound } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { estaActivo } from '../utils/estadoActivo';
import { coincideAlguna, unicosSinMayusculas } from '../utils/texto';
import { mensajeCodigoActivacion, telefonoParaWhatsApp } from '../utils/codigoActivacion';
import FiltroCategorias from './FiltroCategorias';

// Altas y bajas → "Cuentas sin activar": cuentas activas que aún no tienen
// clave propia. Desde CLAVE_INICIAL_HASTA solo entran con un código del club,
// así que se reparten por tandas (filtro por categoría de los hijos). Generar
// y abrir WhatsApp son dos toques separados: abrir una ventana después de
// esperar al servidor lo bloquean los navegadores de teléfono.

const norm = (rut = '') => String(rut || '').replace(/[.\s-]/g, '').trim().toUpperCase();
const correo = (c = '') => String(c || '').trim().toLowerCase();
const fechaHora = (v) => (v ? new Date(v).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const fechaCl = (t) => (/^\d{4}-\d{2}-\d{2}$/.test(String(t || '')) ? String(t).split('-').reverse().join('-') : '');

export default function CuentasSinActivar({ jugadores = [], cuentas = [] }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [categoria, setCategoria] = useState([]);
  const [soloApoderados, setSoloApoderados] = useState(true);
  const [codigos, setCodigos] = useState({});
  const [generando, setGenerando] = useState(null);
  const [abiertos, setAbiertos] = useState(() => new Set());

  const cargar = async () => {
    setCargando(true);
    try {
      setDatos(await api.cuentasAPI.sinActivar());
    } catch (error) {
      showToast({ message: error.message || 'No se pudo cargar.', type: 'error' });
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => { cargar(); }, []);

  const filas = useMemo(() => {
    if (!datos) return [];
    const porId = new Map(cuentas.map((c) => [c.id, c]));
    return (datos.cuentas || [])
      .map((d) => {
        const c = porId.get(d.id);
        if (!c) return null;
        const pupilos = jugadores.filter((j) => estaActivo(j) && (
          (norm(j.rut_apoderado) && norm(j.rut_apoderado) === norm(c.rut))
          || (correo(c.correo).includes('@') && correo(j.correo_apoderado) === correo(c.correo))));
        return { ...d, cuenta: c, pupilos };
      })
      .filter(Boolean)
      .sort((a, b) => `${a.cuenta.apellido_paterno || ''} ${a.cuenta.nombres || ''}`.localeCompare(`${b.cuenta.apellido_paterno || ''} ${b.cuenta.nombres || ''}`, 'es'));
  }, [datos, cuentas, jugadores]);

  const categorias = useMemo(() => unicosSinMayusculas(filas.flatMap((f) => f.pupilos.map((p) => p.categoria))).sort(), [filas]);
  const visibles = filas.filter((f) => (!soloApoderados || f.pupilos.length > 0)
    && (!categoria.length || f.pupilos.some((p) => coincideAlguna(categoria, p.categoria))));

  const generar = async (f) => {
    setGenerando(f.id);
    try {
      const r = await api.cuentasAPI.generarCodigoActivacion(f.id);
      setCodigos((prev) => ({ ...prev, [f.id]: r }));
    } catch (error) {
      showToast({ message: error.message || 'No se pudo generar el código.', type: 'error' });
    } finally {
      setGenerando(null);
    }
  };

  return (
    <section className="card">
      <h4 className="form-subtitle"><KeyRound size={16} /> Cuentas sin activar</h4>
      <p className="fp-ayuda">
        Cuentas activas que todavía no tienen clave propia.
        {datos?.clave_inicial_hasta
          ? ` Hasta el ${fechaCl(datos.clave_inicial_hasta)} aún pueden entrar con la clave inicial; después, solo con un código del club.`
          : ' Solo pueden entrar con un código del club.'}
        {' '}Envía los códigos por tandas: cada código sirve una vez y vence en 48 horas.
      </p>
      <div className="rp-acciones">
        <FiltroCategorias opciones={categorias} valor={categoria} onCambiar={setCategoria} etiqueta="Categorías de los hijos" />
        <label className="checkbox-label-row">
          <input type="checkbox" checked={soloApoderados} onChange={(e) => setSoloApoderados(e.target.checked)} /> Solo con hijos activos
        </label>
        <button type="button" className="btn-secondary tc-btn" disabled={cargando} onClick={cargar}>{cargando ? 'Cargando…' : 'Actualizar'}</button>
      </div>
      {datos && <p className="fp-ayuda">{visibles.length} de {filas.length} cuentas sin activar · {abiertos.size} enviados en esta sesión</p>}
      {datos && visibles.length === 0 && <p className="tc-vacio">No hay cuentas sin activar con este filtro.</p>}
      {visibles.map((f) => {
        const c = f.cuenta;
        const nombre = `${c.nombres || ''} ${c.apellido_paterno || ''}`.trim() || c.rut;
        const r = codigos[f.id];
        const numero = telefonoParaWhatsApp(c.telefono) || telefonoParaWhatsApp(`${c.prefijo_tel || ''}${c.telefono || ''}`);
        return (
          <div key={f.id} className="rp-fila">
            <div className="rp-fila-texto">
              <strong>{nombre} · {c.rut}</strong>
              <small>
                {f.pupilos.length ? f.pupilos.map((p) => `${p.nombres || ''} (${p.categoria || 'sin categoría'})`).join(', ') : 'Sin hijos vinculados'}
                {' · '}{numero ? `+${numero}` : 'sin teléfono'}
                {f.codigo_vigente_hasta && !r ? ` · código vigente hasta ${fechaHora(f.codigo_vigente_hasta)}` : ''}
              </small>
              {r && <small>Código: <strong className="cs-codigo">{r.codigo}</strong> (vence {fechaHora(r.expira_en)})</small>}
            </div>
            {!r ? (
              <button type="button" className="btn-secondary tc-btn" disabled={generando === f.id} onClick={() => generar(f)}>
                {generando === f.id ? 'Generando…' : (f.codigo_vigente_hasta ? 'Nuevo código' : 'Generar código')}
              </button>
            ) : numero ? (
              <a
                className={`btn-electric tc-btn cs-wsp ${abiertos.has(f.id) ? 'wsp-listo' : ''}`}
                href={`https://wa.me/${numero}?text=${encodeURIComponent(mensajeCodigoActivacion(r))}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setAbiertos((prev) => new Set(prev).add(f.id))}
              >
                {abiertos.has(f.id) ? <><Check size={13} /> Enviado</> : 'Abrir WhatsApp'}
              </a>
            ) : (
              <small className="fp-ayuda">Sin teléfono: entrégalo en persona</small>
            )}
          </div>
        );
      })}
    </section>
  );
}

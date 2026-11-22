import { cloneElement, useCallback, useEffect, useId, useState } from 'react';
import { Check, Pencil, UserPlus, X } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import { categoriaPorNacimiento } from '../utils/categoriaPorEdad';
import { mensajeCodigoActivacion, telefonoParaWhatsApp } from '../utils/codigoActivacion';

// Alta de deportistas en dos pasos: el staff propone (SolicitudJugadorStaff)
// y un admin/super_admin aprueba o rechaza (SolicitudesJugadorAdmin). Hasta
// que se aprueba, el deportista no existe en la nómina.

const RAMAS = ['FEMENINA', 'MASCULINA', 'MIXTA', 'ADULTO'];
const VACIO = {
  nombres: '', apellido_paterno: '', apellido_materno: '', rut_jugador: '', fecha_nacimiento: '', rama: '',
  colegio: '', alergias: '', nombre_apoderado: '', rut_apoderado: '', parentesco_apoderado: 'Madre',
  telefono_apoderado: '', correo_apoderado: '',
};
const ETIQUETA_ESTADO = { pendiente: 'Pendiente de aprobación', aprobada: 'Aprobada', rechazada: 'Rechazada' };
const COLOR_ESTADO = { pendiente: '#8A4B00', aprobada: 'var(--verde-victoria)', rechazada: '#C0392B' };

const nombreSolicitud = (s) => `${s.datos?.nombres || ''} ${s.datos?.apellido_paterno || ''} ${s.datos?.apellido_materno || ''}`.trim();

function Campo({ label, children }) {
  const id = useId();
  return <div className="form-group" style={{ marginBottom: 0 }}><label htmlFor={id}>{label}</label>{cloneElement(children, { id })}</div>;
}

// Campos de la solicitud: los usa el staff al proponer y el admin al corregir antes de aprobar.
function CamposSolicitud({ form, set }) {
  const categoria = categoriaPorNacimiento(form.fecha_nacimiento);
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
        <Campo label="Nombres *"><input className="form-input" required value={form.nombres} onChange={set('nombres')} /></Campo>
        <Campo label="Apellido paterno *"><input className="form-input" required value={form.apellido_paterno} onChange={set('apellido_paterno')} /></Campo>
        <Campo label="Apellido materno"><input className="form-input" value={form.apellido_materno} onChange={set('apellido_materno')} /></Campo>
        <Campo label="RUT deportista *"><input className="form-input" required value={form.rut_jugador} onChange={set('rut_jugador')} placeholder="12.345.678-9" /></Campo>
        <Campo label="Fecha de nacimiento *"><input type="date" className="form-input" required value={form.fecha_nacimiento} onChange={set('fecha_nacimiento')} /></Campo>
        <Campo label="Rama *">
          <select className="form-input" required value={form.rama} onChange={set('rama')}>
            <option value="">Elige rama…</option>
            {RAMAS.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
          </select>
        </Campo>
        <Campo label="Categoría"><div className="form-input" aria-live="polite">{categoria || 'Se calcula con la fecha'}</div></Campo>
        <Campo label="Colegio"><input className="form-input" value={form.colegio} onChange={set('colegio')} /></Campo>
        <Campo label="Alergias / salud"><input className="form-input" value={form.alergias} onChange={set('alergias')} /></Campo>
      </div>
      <h4 style={{ margin: '14px 0 8px' }}>Apoderado</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
        <Campo label="Nombre completo *"><input className="form-input" required value={form.nombre_apoderado} onChange={set('nombre_apoderado')} /></Campo>
        <Campo label="RUT apoderado *"><input className="form-input" required value={form.rut_apoderado} onChange={set('rut_apoderado')} placeholder="12.345.678-9" /></Campo>
        <Campo label="Parentesco">
          <select className="form-input" value={form.parentesco_apoderado} onChange={set('parentesco_apoderado')}>
            {['Madre', 'Padre', 'Tutor/a', 'Abuelo/a', 'Otro'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Campo>
        <Campo label="Teléfono (9 dígitos, sin +56) *"><input className="form-input" required inputMode="tel" value={form.telefono_apoderado} onChange={set('telefono_apoderado')} placeholder="912345678" /></Campo>
        <Campo label="Correo"><input type="email" className="form-input" value={form.correo_apoderado} onChange={set('correo_apoderado')} /></Campo>
      </div>
    </>
  );
}

const validarRuts = (form) => {
  if (!api.validarRutChileno(form.rut_jugador)) { showToast({ message: 'RUT del deportista inválido.', type: 'error' }); return false; }
  if (!api.validarRutChileno(form.rut_apoderado)) { showToast({ message: 'RUT del apoderado inválido.', type: 'error' }); return false; }
  return true;
};

export function SolicitudJugadorStaff() {
  const [form, setForm] = useState(VACIO);
  const [enviando, setEnviando] = useState(false);
  const [mias, setMias] = useState([]);

  const cargar = useCallback(async () => {
    try { setMias(await api.solicitudesJugadorAPI.listar()); } catch { setMias([]); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API
  useEffect(() => { void cargar(); }, [cargar]);

  const set = (campo) => (e) => setForm((p) => ({ ...p, [campo]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    if (!validarRuts(form)) return;
    setEnviando(true);
    try {
      await api.solicitudesJugadorAPI.crear(form);
      showToast({ message: 'Solicitud enviada. Queda pendiente hasta que un administrador la apruebe.', type: 'success' });
      setForm(VACIO);
      await cargar();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo enviar la solicitud.', type: 'error' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="card card-estatica" data-testid="solicitud-jugador-staff">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}><UserPlus size={18} /> Proponer nuevo deportista</h3>
      <p className="pf-ayuda" style={{ marginTop: 0 }}>Un administrador revisa y aprueba la incorporación. Hasta entonces no aparece en la nómina.</p>
      <form onSubmit={enviar}>
        <CamposSolicitud form={form} set={set} />
        <button type="submit" className="btn-electric" style={{ marginTop: '14px' }} disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar para aprobación'}</button>
      </form>

      {mias.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ margin: '0 0 8px' }}>Mis solicitudes</h4>
          {mias.map((s) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 0', borderTop: '1px solid var(--borde)' }}>
              <div>
                <b>{nombreSolicitud(s)}</b> <span className="text-muted">· {s.datos?.categoria || 'sin categoría'}</span>
                {s.estado === 'rechazada' && s.motivo_rechazo && <div className="pf-ayuda">Motivo: {s.motivo_rechazo}</div>}
              </div>
              <span style={{ fontWeight: 700, color: COLOR_ESTADO[s.estado] }}>{ETIQUETA_ESTADO[s.estado] || s.estado}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SolicitudesJugadorAdmin({ onAprobada }) {
  const [pendientes, setPendientes] = useState([]);
  const [resolviendoId, setResolviendoId] = useState(null);
  const [edicion, setEdicion] = useState(null); // { id, form } mientras se corrigen datos
  // Apoderados a los que se les creó cuenta al aprobar: falta entregarles el código.
  const [cuentasNuevas, setCuentasNuevas] = useState([]);
  const generarCodigo = async (c) => {
    try {
      const codigo = await api.cuentasAPI.generarCodigoActivacion(c.id);
      setCuentasNuevas((prev) => prev.map((x) => (x.id === c.id ? { ...x, codigo } : x)));
    } catch (error) {
      showToast({ message: error.message || 'No se pudo generar el código.', type: 'error' });
    }
  };
  const setEdicionCampo = (campo) => (e) => setEdicion((p) => ({ ...p, form: { ...p.form, [campo]: e.target.value } }));

  const cargar = useCallback(async () => {
    try { setPendientes(await api.solicitudesJugadorAPI.listar('pendiente')); } catch { setPendientes([]); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API
  useEffect(() => { void cargar(); }, [cargar]);

  const resolver = async (s, aprobar, datos) => {
    let motivo = '';
    if (datos && !validarRuts(datos)) return;
    if (aprobar) {
      if (!await confirmAction({ title: 'Aprobar incorporación', message: `${nombreSolicitud(s)} quedará en la nómina del club.`, confirmText: 'Aprobar' })) return;
    } else {
      motivo = await confirmAction({ title: 'Rechazar solicitud', message: `Rechazar a ${nombreSolicitud(s)}.`, confirmText: 'Rechazar', danger: true, pedirTexto: { etiqueta: 'Motivo (obligatorio)', placeholder: 'Ej: RUT duplicado' } });
      if (!motivo) return;
    }
    setResolviendoId(s.id);
    try {
      const r = await api.solicitudesJugadorAPI.resolver(s.id, { aprobar, motivo, datos });
      const nombre = datos ? nombreSolicitud({ datos }) : nombreSolicitud(s);
      showToast({
        message: aprobar ? `${nombre} incorporado a la nómina.${r?.cuenta_apoderado_creada ? ' Se creó la cuenta del apoderado (se activa con el código del club).' : ''}` : 'Solicitud rechazada.',
        type: aprobar ? 'success' : 'info',
      });
      setEdicion(null);
      const fuente = datos || s.datos || {};
      if (r?.cuenta_apoderado_id) {
        setCuentasNuevas((prev) => [...prev, { id: r.cuenta_apoderado_id, nombre: fuente.nombre_apoderado, telefono: fuente.telefono_apoderado }]);
      }
      await cargar();
      if (aprobar) await onAprobada?.();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo resolver la solicitud.', type: 'error' });
    } finally {
      setResolviendoId(null);
    }
  };

  const avisoCuentas = cuentasNuevas.length > 0 && (
    <div className="card card-estatica" data-testid="cuentas-apoderado-nuevas" style={{ borderLeft: '4px solid var(--verde-victoria)' }}>
      <h3 style={{ marginTop: 0 }}>Entrega el código a los apoderados nuevos</h3>
      <p className="pf-ayuda" style={{ marginTop: 0 }}>Su cuenta se creó sin contraseña: la activan con este código del club.</p>
      {cuentasNuevas.map((c) => {
        const numero = telefonoParaWhatsApp(c.telefono);
        return (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '8px 0', borderTop: '1px solid var(--borde)', flexWrap: 'wrap' }}>
            <span><b>{c.nombre}</b>{c.codigo ? ` · código ${c.codigo.codigo}` : ''}</span>
            {!c.codigo ? (
              <button type="button" className="btn-secondary tc-btn" onClick={() => generarCodigo(c)}>Generar código</button>
            ) : numero ? (
              <a className="btn-electric tc-btn" href={`https://wa.me/${numero}?text=${encodeURIComponent(mensajeCodigoActivacion(c.codigo))}`} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>
            ) : (
              <span className="pf-ayuda">Sin teléfono válido: entrégalo en persona.</span>
            )}
          </div>
        );
      })}
    </div>
  );

  if (pendientes.length === 0) return avisoCuentas || null;
  return (
    <>
    {avisoCuentas}
    <div className="card card-estatica" data-testid="solicitudes-jugador-admin" style={{ borderLeft: '4px solid #FF9500' }}>
      <h3 style={{ marginTop: 0 }}>Deportistas por aprobar ({pendientes.length})</h3>
      {pendientes.map((s) => {
        const d = s.datos || {};
        return (
          <div key={s.id} style={{ padding: '10px 0', borderTop: '1px solid var(--borde)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <b>{nombreSolicitud(s)}</b> · {d.rut_jugador} · {d.fecha_nacimiento} · {d.rama} {d.categoria || ''}
                <div className="pf-ayuda">
                  Apoderado: {d.nombre_apoderado} ({d.parentesco_apoderado || 'sin parentesco'}) · {d.rut_apoderado} · +56 {d.telefono_apoderado}{d.correo_apoderado ? ` · ${d.correo_apoderado}` : ''}
                  {d.colegio ? ` · Colegio: ${d.colegio}` : ''}{d.alergias ? ` · Salud: ${d.alergias}` : ''}
                </div>
                <div className="pf-ayuda">
                  {s.apoderado_cuenta_id
                    ? `Apoderado con cuenta (${s.apoderado_cuenta_nombre || d.rut_apoderado}): quedará vinculado.`
                    : 'Apoderado sin cuenta: al aprobar se crea (se activa con el código del club).'}
                </div>
                <div className="pf-ayuda">Propuesto por {s.creado_por_nombre || s.creado_por_rut}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button type="button" className="btn-electric tc-btn" disabled={resolviendoId === s.id || edicion?.id === s.id} onClick={() => resolver(s, true)}><Check size={14} /> Aprobar</button>
                <button type="button" className="btn-secondary tc-btn" disabled={resolviendoId === s.id} onClick={() => setEdicion(edicion?.id === s.id ? null : { id: s.id, form: { ...VACIO, ...d } })}><Pencil size={14} /> Corregir</button>
                <button type="button" className="btn-secondary tc-btn" disabled={resolviendoId === s.id} onClick={() => resolver(s, false)}><X size={14} /> Rechazar</button>
              </div>
            </div>
            {edicion?.id === s.id && (
              <form onSubmit={(e) => { e.preventDefault(); void resolver(s, true, edicion.form); }} style={{ marginTop: '10px' }}>
                <CamposSolicitud form={edicion.form} set={setEdicionCampo} />
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button type="submit" className="btn-electric tc-btn" disabled={resolviendoId === s.id}><Check size={14} /> Guardar y aprobar</button>
                  <button type="button" className="btn-secondary tc-btn" onClick={() => setEdicion(null)}>Cancelar</button>
                </div>
              </form>
            )}
          </div>
        );
      })}
    </div>
    </>
  );
}

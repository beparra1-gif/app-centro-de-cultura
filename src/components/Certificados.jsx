import { cloneElement, useCallback, useEffect, useId, useState } from 'react';
import { AlertTriangle, Award, Check, CheckCircle2, Download, FileSignature, Upload, X } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import { mismoTexto, unicosSinMayusculas } from '../utils/texto';
import {
  DIAS_SEMANA, TIPOS_CERTIFICADO, TIPOS_ESTABLECIMIENTO, TORNEOS_SUGERIDOS, tipoCertificado, fechaLarga, generarPdfCertificadoClub,
} from '../utils/certificados';

// Certificados del club: el apoderado solicita (CertificadosFamilia), un admin
// revisa, completa y emite (CertificadosAdmin) y cualquiera valida el QR
// (VerificarCertificado, sin iniciar sesión).

const ETIQUETA = { pendiente: 'En revisión', emitido: 'Listo para descargar', rechazado: 'Rechazado', anulado: 'Anulado' };
const COLOR = { pendiente: '#8A4B00', emitido: 'var(--verde-victoria)', rechazado: '#B42318', anulado: '#B42318' };
const tituloTipo = (id) => tipoCertificado(id)?.titulo || id;
const normRut = (rut) => String(rut || '').replace(/[.\s-]/g, '').toUpperCase();
const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;

function Campo({ label, ayuda, children }) {
  const id = useId();
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
      {ayuda && <small className="pf-ayuda">{ayuda}</small>}
    </div>
  );
}

// Aviso de deuda (moroso: fila de morososAdmin) para el certificado de vigencia y pago.
function AvisoCuota({ moroso, paraAdmin }) {
  if (!moroso) {
    return (
      <p className="pf-ayuda" role="status" style={{ color: 'var(--verde-victoria)', fontWeight: 700, display: 'flex', gap: '6px', alignItems: 'center' }}>
        <CheckCircle2 size={14} /> Mensualidades al día.
      </p>
    );
  }
  return (
    <p className="pf-ayuda" role="alert" style={{ color: '#B42318', fontWeight: 700, display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
      <span>
        Registra {moroso.mesesDeuda} mensualidad{moroso.mesesDeuda === 1 ? '' : 'es'} pendiente{moroso.mesesDeuda === 1 ? '' : 's'}
        {moroso.mesesMorosos?.length ? ` (${moroso.mesesMorosos.join(', ')})` : ''}{moroso.montoDeuda ? ` por ${pesos(moroso.montoDeuda)}` : ''}.
        {paraAdmin
          ? ' No se puede emitir hasta que todas estén pagadas y validadas en Tesorería.'
          : ' Este certificado solo se emite con todas las mensualidades al día: puedes solicitarlo y Secretaría lo emitirá cuando estén pagadas.'}
      </span>
    </p>
  );
}

const descargar = async (cert) => {
  try {
    const recursos = await api.certificadosAPI.recursos(cert.id).catch(() => ({}));
    await generarPdfCertificadoClub(cert, recursos);
  } catch (error) {
    showToast({ message: error.message || 'No se pudo generar el PDF.', type: 'error' });
  }
};

// "Colegio" + "Los Pinos" → "Colegio Los Pinos" (sin repetir si ya lo escribió).
const destinatario = (tipo, nombre) => {
  const n = String(nombre || '').trim();
  if (!n) return '';
  return !tipo || tipo === 'Otro' || n.toLowerCase().startsWith(tipo.toLowerCase()) ? n : `${tipo} ${n}`;
};

// pupilos: forma de pupiloMapper (rut, nombre). morosos: filas de morososAdmin.
export function CertificadosFamilia({ pupilos = [], morosos = [] }) {
  const [form, setForm] = useState({ rut_jugador: '', tipo: 'alumno_regular', tipo_establecimiento: 'Colegio', nombre_establecimiento: '', motivo: '' });
  const [lista, setLista] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const rutElegido = form.rut_jugador || pupilos[0]?.rut || '';
  const morosoElegido = morosos.find((m) => normRut(m.rut) === normRut(rutElegido)) || null;

  const cargar = useCallback(async () => {
    try { setLista(await api.certificadosAPI.listar()); } catch { setLista([]); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API
  useEffect(() => { void cargar(); }, [cargar]);

  const set = (campo) => (e) => setForm((p) => ({ ...p, [campo]: e.target.value }));
  const tipo = tipoCertificado(form.tipo);

  const solicitar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.certificadosAPI.solicitar({
        rut_jugador: rutElegido,
        tipo: form.tipo,
        motivo: form.motivo,
        presentado_ante: form.tipo === 'participacion_permiso' ? destinatario(form.tipo_establecimiento, form.nombre_establecimiento) : '',
      });
      showToast({ message: 'Solicitud enviada. Te avisaremos cuando el certificado esté listo.', type: 'success' });
      setForm((p) => ({ ...p, nombre_establecimiento: '', motivo: '' }));
      await cargar();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo enviar la solicitud.', type: 'error' });
    } finally {
      setEnviando(false);
    }
  };

  if (pupilos.length === 0) return null;
  return (
    <div className="card card-estatica mt-20" data-testid="certificados-familia">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}><Award size={18} /> Certificados del club</h3>
      <p className="pf-ayuda" style={{ marginTop: 0 }}>Solicítalo aquí; Secretaría lo revisa y lo firma. Cada certificado trae un código QR para comprobar que es auténtico.</p>
      <form onSubmit={solicitar} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
        {pupilos.length > 1 && (
          <Campo label="Deportista">
            <select className="form-input" value={rutElegido} onChange={set('rut_jugador')}>
              {pupilos.map((p) => <option key={p.rut} value={p.rut}>{p.nombre}</option>)}
            </select>
          </Campo>
        )}
        <Campo label="Tipo de certificado" ayuda={tipo?.para}>
          <select className="form-input" value={form.tipo} onChange={set('tipo')}>
            {TIPOS_CERTIFICADO.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
          </select>
        </Campo>
        {form.tipo === 'participacion_permiso' && (
          <>
            <Campo label="Va dirigido a (tipo de establecimiento)">
              <select className="form-input" value={form.tipo_establecimiento} onChange={set('tipo_establecimiento')}>
                {TIPOS_ESTABLECIMIENTO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Campo>
            <Campo label="Nombre del establecimiento">
              <input className="form-input" required maxLength={200} value={form.nombre_establecimiento} onChange={set('nombre_establecimiento')} placeholder="Ej: Los Pinos de Viña del Mar" />
            </Campo>
          </>
        )}
        <Campo label="Motivo (opcional)">
          <input className="form-input" maxLength={300} value={form.motivo} onChange={set('motivo')} placeholder="Ej: lo pide el colegio" />
        </Campo>
        {tipo?.requiereAlDia && <div style={{ gridColumn: '1 / -1' }}><AvisoCuota moroso={morosoElegido} /></div>}
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="submit" className="btn-electric" disabled={enviando}>{enviando ? 'Enviando…' : 'Solicitar certificado'}</button>
        </div>
      </form>

      {lista.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ margin: '0 0 6px' }}>Mis certificados</h4>
          {lista.map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--borde)' }}>
              <div>
                <b>{tituloTipo(c.tipo)}</b> <span className="text-muted">· {c.nombre_jugador}</span>
                {c.folio && <div className="pf-ayuda">Folio {c.folio}{c.vigencia_hasta ? ` · válido hasta ${fechaLarga(c.vigencia_hasta)}` : ''}</div>}
                {['rechazado', 'anulado'].includes(c.estado) && c.motivo_rechazo && <div className="pf-ayuda">Motivo: {c.motivo_rechazo}</div>}
              </div>
              {c.estado === 'emitido'
                ? <button type="button" className="btn-electric tc-btn" onClick={() => descargar(c)}><Download size={14} /> Descargar PDF</button>
                : <span style={{ fontWeight: 700, color: COLOR[c.estado] }}>{ETIQUETA[c.estado] || c.estado}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const textoALista = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);
const horaCorta = (h) => String(h || '').slice(0, 5);
// dias_semana de horarios_entrenamiento: 0 = domingo … 6 = sábado.
const DIA_POR_INDICE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const semanaVacia = () => Object.fromEntries(DIAS_SEMANA.map((d) => [d, { activo: false, desde: '', hasta: '' }]));

// Sugerencia de horario según los entrenamientos registrados para la categoría y rama.
const sugerirSemana = (horarios, categoria, rama) => {
  const semana = semanaVacia();
  (Array.isArray(horarios) ? horarios : [])
    .filter((h) => h.tipo_recurrencia !== 'mensual' && mismoTexto(h.categoria, categoria) && (!rama || mismoTexto(h.rama, rama)))
    .forEach((h) => (h.dias_semana || (h.dia_semana != null ? [h.dia_semana] : [])).forEach((i) => {
      const dia = DIA_POR_INDICE[i];
      if (dia && !semana[dia].activo) semana[dia] = { activo: true, desde: horaCorta(h.hora_inicio), hasta: horaCorta(h.hora_fin) };
    }));
  return semana;
};

// Tabla Lunes–Domingo: el admin marca los días y escribe el horario de cada uno.
function HorarioSemana({ semana, onCambiar }) {
  const cambiar = (dia, campo, valor) => onCambiar({ ...semana, [dia]: { ...semana[dia], [campo]: valor } });
  return (
    <fieldset style={{ gridColumn: '1 / -1', border: '1px solid var(--borde)', borderRadius: 'var(--radius-md)', padding: '10px 12px', margin: 0 }}>
      <legend style={{ fontWeight: 800, fontSize: '13px', padding: '0 4px' }}>Días y horarios de entrenamiento</legend>
      <small className="pf-ayuda" style={{ marginTop: 0, marginBottom: '8px' }}>Sugeridos según la categoría; corrígelos si este deportista entrena distinto. Quedan registrados en el certificado.</small>
      <div style={{ display: 'grid', gap: '6px' }}>
        {DIAS_SEMANA.map((dia) => (
          <div key={dia} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 1fr) 1fr 1fr', gap: '8px', alignItems: 'center' }}>
            <label className="checkbox-label-row" style={{ margin: 0 }}>
              <input type="checkbox" checked={semana[dia].activo} onChange={(e) => cambiar(dia, 'activo', e.target.checked)} /> {dia}
            </label>
            <input type="time" className="form-input" aria-label={`${dia}: desde`} disabled={!semana[dia].activo} required={semana[dia].activo} value={semana[dia].desde} onChange={(e) => cambiar(dia, 'desde', e.target.value)} />
            <input type="time" className="form-input" aria-label={`${dia}: hasta`} disabled={!semana[dia].activo} required={semana[dia].activo} value={semana[dia].hasta} onChange={(e) => cambiar(dia, 'hasta', e.target.value)} />
          </div>
        ))}
      </div>
    </fieldset>
  );
}

// Casillas de competiciones: ninguna viene marcada, el admin elige las de este deportista.
function Competiciones({ opciones, elegidas, otras, onElegir, onOtras }) {
  const alternar = (c) => onElegir(elegidas.includes(c) ? elegidas.filter((x) => x !== c) : [...elegidas, c]);
  return (
    <fieldset style={{ gridColumn: '1 / -1', border: '1px solid var(--borde)', borderRadius: 'var(--radius-md)', padding: '10px 12px', margin: 0 }}>
      <legend style={{ fontWeight: 800, fontSize: '13px', padding: '0 4px' }}>Competiciones en que participa</legend>
      <small className="pf-ayuda" style={{ marginTop: 0, marginBottom: '8px' }}>Marca solo las que corresponden. Las primeras salen de las citaciones de este deportista en la app.</small>
      <div style={{ display: 'grid', gap: '4px' }}>
        {opciones.map((c) => (
          <label key={c} className="checkbox-label-row" style={{ margin: 0 }}>
            <input type="checkbox" checked={elegidas.includes(c)} onChange={() => alternar(c)} /> {c}
          </label>
        ))}
      </div>
      <div style={{ marginTop: '8px' }}>
        <Campo label="Otras competiciones (una por línea)">
          <textarea className="form-input" rows={2} value={otras} onChange={(e) => onOtras(e.target.value)} placeholder="Ej: Copa Primavera 2026" />
        </Campo>
      </div>
    </fieldset>
  );
}

// morososPorRut: Map RUT normalizado → fila de morososAdmin (la misma deuda que muestra Tesorería).
export function CertificadosAdmin({ morososPorRut = new Map() }) {
  const [vista, setVista] = useState('pendientes');
  const [lista, setLista] = useState([]);
  const [edicion, setEdicion] = useState(null); // { cert, form, competiciones }
  const [trabajando, setTrabajando] = useState(false);
  const [recursos, setRecursos] = useState([]);

  const cargar = useCallback(async () => {
    try { setLista(await api.certificadosAPI.listar()); } catch { setLista([]); }
    try { setRecursos(await api.certificadosAPI.estadoRecursos()); } catch { setRecursos([]); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API
  useEffect(() => { void cargar(); }, [cargar]);

  const pendientes = lista.filter((c) => c.estado === 'pendiente');
  const resueltos = lista.filter((c) => c.estado !== 'pendiente');
  const faltanFirmas = recursos.filter((r) => !r.cargado_en).map((r) => r.clave);
  const morosoDe = (c) => morososPorRut.get(normRut(c.rut_jugador)) || null;

  const abrir = async (c) => {
    let semana = semanaVacia();
    let competiciones = TORNEOS_SUGERIDOS;
    if (c.tipo === 'participacion_permiso') {
      try { semana = sugerirSemana(await api.horariosEntrenamientoAPI.getAll(), c.categoria_actual, c.rama_actual); } catch { /* el admin los escribe */ }
    }
    if (c.tipo === 'permanencia_participacion') {
      try {
        const citaciones = await api.citacionesAPI.getAll();
        const propias = (Array.isArray(citaciones) ? citaciones : [])
          .filter((ci) => (ci.convocados || []).some((cv) => normRut(cv.rut_jugador) === normRut(c.rut_jugador)))
          .map((ci) => String(ci.competencia_nombre || '').trim());
        competiciones = unicosSinMayusculas([...propias, ...TORNEOS_SUGERIDOS]);
      } catch { /* quedan las de la plantilla */ }
    }
    setEdicion({
      cert: c,
      competiciones,
      form: { tipo: c.tipo, presentado_ante: c.presentado_ante || '', vigencia_hasta: '', observacion: '', semana, torneos: [], otrasCompeticiones: '', monto_cuota: '' },
    });
  };
  const setCampo = (campo) => (e) => setEdicion((p) => ({ ...p, form: { ...p.form, [campo]: e.target.value } }));
  const setValor = (campo, valor) => setEdicion((p) => ({ ...p, form: { ...p.form, [campo]: valor } }));

  const emitir = async (e) => {
    e.preventDefault();
    const { cert, form } = edicion;
    const moroso = morosoDe(cert);
    if (form.tipo === 'vigencia_pago' && moroso) {
      showToast({ message: 'No se puede emitir: el deportista tiene mensualidades pendientes.', type: 'error' });
      return;
    }
    const horarioSemana = DIAS_SEMANA.filter((d) => form.semana[d].activo).map((d) => ({ dia: d, desde: form.semana[d].desde, hasta: form.semana[d].hasta }));
    if (form.tipo === 'participacion_permiso' && horarioSemana.length === 0) {
      showToast({ message: 'Marca al menos un día de entrenamiento con su horario.', type: 'error' });
      return;
    }
    const torneos = [...form.torneos, ...textoALista(form.otrasCompeticiones)];
    if (form.tipo === 'permanencia_participacion' && torneos.length === 0) {
      showToast({ message: 'Marca o escribe al menos una competición.', type: 'error' });
      return;
    }
    setTrabajando(true);
    try {
      const emitido = await api.certificadosAPI.emitir(cert.id, {
        tipo: form.tipo,
        presentado_ante: form.presentado_ante,
        vigencia_hasta: form.vigencia_hasta || undefined,
        observacion: form.observacion,
        // Solo se envía cuando Tesorería no registra deuda (ver AvisoCuota).
        al_dia_verificado: !moroso,
        extra: { horario_semana: horarioSemana, torneos, monto_cuota: form.monto_cuota },
      });
      showToast({ message: `Certificado ${emitido.folio} emitido. La familia ya puede descargarlo.`, type: 'success' });
      setEdicion(null);
      await cargar();
      await descargar({ ...emitido, nombre_jugador: cert.nombre_jugador });
    } catch (error) {
      showToast({ message: error.message || 'No se pudo emitir.', type: 'error' });
    } finally {
      setTrabajando(false);
    }
  };

  const conMotivo = async (c, accion) => {
    const motivo = await confirmAction({
      title: accion === 'rechazar' ? 'Rechazar solicitud' : 'Anular certificado',
      message: accion === 'rechazar' ? `Rechazar el ${tituloTipo(c.tipo).toLowerCase()} de ${c.nombre_jugador}.` : `El QR de ${c.folio} mostrará que ya no es válido.`,
      confirmText: accion === 'rechazar' ? 'Rechazar' : 'Anular',
      danger: true,
      pedirTexto: { etiqueta: 'Motivo (obligatorio)', placeholder: 'Ej: datos incorrectos' },
    });
    if (!motivo) return;
    try {
      await api.certificadosAPI[accion](c.id, motivo);
      showToast({ message: accion === 'rechazar' ? 'Solicitud rechazada.' : 'Certificado anulado.', type: 'info' });
      await cargar();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo actualizar.', type: 'error' });
    }
  };

  const subir = async (clave, archivo) => {
    if (!archivo) return;
    try {
      await api.certificadosAPI.subirRecurso(clave, archivo);
      showToast({ message: 'Imagen guardada.', type: 'success' });
      await cargar();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo guardar la imagen.', type: 'error' });
    }
  };

  const tipoForm = edicion && tipoCertificado(edicion.form.tipo);
  const bloqueadoPorDeuda = Boolean(edicion && tipoForm?.requiereAlDia && morosoDe(edicion.cert));
  return (
    <div className="card card-estatica" data-testid="certificados-admin">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}><FileSignature size={18} /> Certificados</h3>
      {faltanFirmas.length > 0 && (
        <p className="pf-ayuda" role="status" style={{ color: '#8A4B00' }}>
          Faltan imágenes de firma o timbre ({faltanFirmas.join(', ').replace(/_/g, ' ')}): súbelas en "Firmas y timbre" para que salgan en los PDF.
        </p>
      )}
      <div className="segment-control mb-10" role="group" aria-label="Secciones de certificados">
        <button type="button" className={`segment-btn ${vista === 'pendientes' ? 'active' : ''}`} onClick={() => setVista('pendientes')}>Por emitir ({pendientes.length})</button>
        <button type="button" className={`segment-btn ${vista === 'resueltos' ? 'active' : ''}`} onClick={() => setVista('resueltos')}>Emitidos y otros</button>
        <button type="button" className={`segment-btn ${vista === 'firmas' ? 'active' : ''}`} onClick={() => setVista('firmas')}>Firmas y timbre</button>
      </div>

      {vista === 'pendientes' && pendientes.length === 0 && <p className="text-muted">No hay solicitudes pendientes.</p>}
      {vista === 'pendientes' && pendientes.map((c) => (
        <div key={c.id} style={{ padding: '10px 0', borderTop: '1px solid var(--borde)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <div>
              <b>{c.nombre_jugador}</b> · {tituloTipo(c.tipo)}
              <div className="pf-ayuda">
                {[c.categoria_actual, c.rama_actual].filter(Boolean).join(' ')} · Solicitado por {c.solicitado_por_nombre}
                {c.presentado_ante ? ` · Para: ${c.presentado_ante}` : ''}{c.motivo ? ` · ${c.motivo}` : ''}
              </div>
              {tipoCertificado(c.tipo)?.requiereAlDia && <AvisoCuota moroso={morosoDe(c)} paraAdmin />}
              {c.tipo === 'liberacion' && morosoDe(c) && (
                <div className="pf-ayuda" style={{ color: '#B42318', fontWeight: 700 }}>Registra mensualidades pendientes: revisa antes de otorgar la liberación.</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button type="button" className="btn-electric tc-btn" onClick={() => abrir(c)}><Check size={14} /> Revisar y emitir</button>
              <button type="button" className="btn-secondary tc-btn" onClick={() => conMotivo(c, 'rechazar')}><X size={14} /> Rechazar</button>
            </div>
          </div>
          {edicion?.cert.id === c.id && (
            <form onSubmit={emitir} style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              <Campo label="Tipo">
                <select className="form-input" value={edicion.form.tipo} onChange={setCampo('tipo')}>
                  {TIPOS_CERTIFICADO.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
                </select>
              </Campo>
              <Campo label="Válido hasta" ayuda="Vacío = lo que indica la plantilla (90 o 30 días, o sin vencimiento).">
                <input type="date" className="form-input" value={edicion.form.vigencia_hasta} onChange={setCampo('vigencia_hasta')} />
              </Campo>
              {tipoForm?.campos.includes('presentado_ante') && (
                <Campo label="Establecimiento educacional (a quién va dirigido)"><input className="form-input" required value={edicion.form.presentado_ante} onChange={setCampo('presentado_ante')} /></Campo>
              )}
              {tipoForm?.campos.includes('monto_cuota') && (
                <Campo label="Cuota mensual ($)"><input className="form-input" required inputMode="numeric" value={edicion.form.monto_cuota} onChange={setCampo('monto_cuota')} placeholder="30000" /></Campo>
              )}
              {tipoForm?.campos.includes('horario_semana') && (
                <HorarioSemana semana={edicion.form.semana} onCambiar={(v) => setValor('semana', v)} />
              )}
              {tipoForm?.campos.includes('torneos') && (
                <Competiciones
                  opciones={edicion.competiciones}
                  elegidas={edicion.form.torneos}
                  otras={edicion.form.otrasCompeticiones}
                  onElegir={(v) => setValor('torneos', v)}
                  onOtras={(v) => setValor('otrasCompeticiones', v)}
                />
              )}
              <Campo label="Observación (opcional)"><input className="form-input" maxLength={500} value={edicion.form.observacion} onChange={setCampo('observacion')} /></Campo>
              {tipoForm?.requiereAlDia && <div style={{ gridColumn: '1 / -1' }}><AvisoCuota moroso={morosoDe(c)} paraAdmin /></div>}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <button type="submit" className="btn-electric tc-btn" disabled={trabajando || bloqueadoPorDeuda}><FileSignature size={14} /> {trabajando ? 'Emitiendo…' : 'Emitir y descargar'}</button>
                <button type="button" className="btn-secondary tc-btn" onClick={() => setEdicion(null)}>Cancelar</button>
              </div>
            </form>
          )}
        </div>
      ))}

      {vista === 'resueltos' && resueltos.length === 0 && <p className="text-muted">Aún no se emiten certificados.</p>}
      {vista === 'resueltos' && resueltos.map((c) => (
        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--borde)' }}>
          <div>
            <b>{c.folio || '—'}</b> · {c.nombre_jugador} · {tituloTipo(c.tipo)}
            <div className="pf-ayuda">
              <span style={{ color: COLOR[c.estado], fontWeight: 700 }}>{c.estado === 'emitido' ? 'Emitido' : ETIQUETA[c.estado]}</span>
              {c.datos?.fecha_emision ? ` · ${fechaLarga(c.datos.fecha_emision)}` : ''}{c.motivo_rechazo ? ` · Motivo: ${c.motivo_rechazo}` : ''}
            </div>
          </div>
          {c.estado === 'emitido' && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" className="btn-secondary tc-btn" onClick={() => descargar(c)}><Download size={14} /> PDF</button>
              <button type="button" className="btn-secondary tc-btn" onClick={() => conMotivo(c, 'anular')}>Anular</button>
            </div>
          )}
        </div>
      ))}

      {vista === 'firmas' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {recursos.map((r) => (
            <Campo key={r.clave} label={r.clave.replace('_', ' de ').replace('firma de presidente', 'Firma de presidencia').replace(/^./, (x) => x.toUpperCase())}
              ayuda={r.cargado_en ? `Cargada el ${new Date(r.cargado_en).toLocaleDateString('es-CL')}` : 'Sin cargar · PNG con fondo transparente'}>
              <input type="file" accept="image/png,image/jpeg" className="form-input" onChange={(e) => subir(r.clave, e.target.files?.[0])} />
            </Campo>
          ))}
          <p className="pf-ayuda" style={{ gridColumn: '1 / -1' }}>
            <Upload size={12} /> Las imágenes se guardan en el servidor y solo se usan dentro de certificados emitidos; no quedan públicas en la app.
          </p>
        </div>
      )}
    </div>
  );
}

// Página pública que abre el QR (?verificar=CODIGO), sin iniciar sesión.
export function VerificarCertificado({ codigo }) {
  const [resultado, setResultado] = useState(null);
  useEffect(() => {
    let activo = true;
    api.certificadosAPI.verificar(codigo).then((r) => { if (activo) setResultado(r); });
    return () => { activo = false; };
  }, [codigo]);

  const ok = resultado?.valido;
  const estadoTxt = { vigente: 'Certificado válido y vigente', vencido: 'Certificado auténtico, pero vencido', anulado: 'Certificado anulado' }[resultado?.estado];
  return (
    <main className="verificar-cert" style={{ minHeight: '100vh', background: 'var(--fondo-app, #f2f4f8)', padding: '32px 16px', color: 'var(--texto-principal)' }}>
      <div className="card card-estatica" style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
        <img src="/logos/club-logo.png" alt="Centro de Cultura Física Viña del Mar" width="88" height="88" style={{ margin: '0 auto 8px', display: 'block' }} />
        <h1 style={{ fontSize: '20px', margin: '0 0 4px' }}>Verificación de certificado</h1>
        <p className="pf-ayuda" style={{ marginTop: 0 }}>Centro de Cultura Física Viña del Mar</p>
        {!resultado && <p role="status">Verificando…</p>}
        {resultado && (
          <div role="status" data-testid="resultado-verificacion">
            <p style={{ fontSize: '18px', fontWeight: 800, color: ok ? 'var(--verde-victoria)' : '#B42318', margin: '16px 0' }}>
              {ok ? '✓ ' : '✗ '}{estadoTxt || resultado.error || 'No existe un certificado con ese código.'}
            </p>
            {resultado.folio && (
              <dl style={{ textAlign: 'left', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', margin: 0 }}>
                <dt>Folio</dt><dd style={{ margin: 0 }}><b>{resultado.folio}</b></dd>
                <dt>Documento</dt><dd style={{ margin: 0 }}>{resultado.titulo}</dd>
                <dt>Deportista</dt><dd style={{ margin: 0 }}>{resultado.nombre} · RUT {resultado.rut}</dd>
                {resultado.categoria && <><dt>Categoría</dt><dd style={{ margin: 0 }}>{[resultado.categoria, resultado.rama].filter(Boolean).join(' ')}</dd></>}
                <dt>Emitido</dt><dd style={{ margin: 0 }}>{fechaLarga(resultado.fecha_emision)}</dd>
                {resultado.vigencia_hasta && <><dt>Válido hasta</dt><dd style={{ margin: 0 }}>{fechaLarga(resultado.vigencia_hasta)}</dd></>}
              </dl>
            )}
            <p className="pf-ayuda" style={{ marginTop: '16px' }}>Compara estos datos con el documento impreso. Ante dudas escribe a cdculturafisica702@gmail.com.</p>
          </div>
        )}
      </div>
    </main>
  );
}

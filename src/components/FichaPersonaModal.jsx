import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Pencil, Plus, Trash2, User, Users, X } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import useModalAccesible from '../utils/useModalAccesible';
import { calcularCuotaDeportistasFamilia, obtenerCuotaJugador, obtenerPorcentajeBeca, noDebeMensualidad } from '../utils/beca';
import { ETIQUETA_ESTADO, MESES_INFORME, construirInformeDeportistas, construirInformeSocios } from '../utils/informeDeuda';
import { normalizarRol } from '../security/accessControl';

// Usuarios y Cuentas → "Ver ficha": ventana con todo lo de una persona
// (deportista o cuenta): datos, vínculo apoderado ↔ pupilos (navegable) y
// pagos (meses del año + historial). Solo lectura; "Editar" abre el
// formulario de siempre y "Registrar pago" el pago manual.

const norm = (rut = '') => String(rut || '').replace(/[.\s-]/g, '').trim().toUpperCase();
const correo = (c = '') => String(c || '').trim().toLowerCase();
const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;
const fecha = (v) => {
  const t = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t.split('-').reverse().join('-') : (v || '');
};
const edad = (v) => {
  const t = String(v || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [a, m, d] = t.split('-').map(Number);
  const hoy = new Date();
  return hoy.getFullYear() - a - ((hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) ? 1 : 0);
};
const SIMBOLO = { condonado: 'C', pagado: '✓', debe: '✕', parcial: '½', exento: 'B', 'no-aplica': '–', 'en-curso': '·', futuro: '' };
const ETIQUETA_ROL = {
  super_admin: 'Super admin', admin: 'Admin', directiva: 'Directiva', socio: 'Socio', socio_apoderado: 'Socio / Apoderado',
  apoderado: 'Apoderado', jugador: 'Deportista', staff: 'Staff', mesa: 'Mesa', visita: 'Visita',
};

function Dato({ etiqueta, valor }) {
  if (valor === null || valor === undefined || valor === '') return null;
  return (
    <div className="fp-dato">
      <span>{etiqueta}</span>
      <strong>{valor}</strong>
    </div>
  );
}

function GrillaMeses({ titulo, fila }) {
  if (!fila) return null;
  return (
    <div className="fp-grilla">
      <div className="fp-grilla-titulo">
        <strong>{titulo}</strong>
        <span className={fila.montoDeuda > 0 ? 'debe' : 'ok'}>
          {fila.montoDeuda > 0 ? `Debe ${pesos(fila.montoDeuda)} (${fila.mesesDeuda} ${fila.mesesDeuda === 1 ? 'mes' : 'meses'})` : 'Al día'}
        </span>
      </div>
      <div className="fp-meses">
        {fila.estados.map((e, i) => (
          <div key={MESES_INFORME[i]} className={`fp-mes id-${e}`} title={`${MESES_INFORME[i]}: ${ETIQUETA_ESTADO[e]}`}>
            <small>{MESES_INFORME[i]}</small>
            <b>{SIMBOLO[e]}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function TablaPagos({ pagos, puedeBorrar = false, onBorrar }) {
  if (!pagos.length) return <p className="tc-vacio">Sin pagos registrados.</p>;
  return (
    <div className="fp-tabla-scroll">
      <table className="fp-tabla">
        <thead>
          <tr><th>Mes</th><th>Concepto</th><th>Monto</th><th>Estado</th><th>Notas</th>{puedeBorrar && <th aria-label="Acciones" />}</tr>
        </thead>
        <tbody>
          {pagos.map((p) => (
            <tr key={p.id}>
              <td>{p.meses_correspondientes || '—'}</td>
              <td>{p.concepto_pago || 'Mensualidad'}</td>
              <td className="fp-num">{pesos(p.monto_total_pagado)}</td>
              <td><span className={`fp-estado fp-estado-${String(p.estado_pago || '').toLowerCase()}`}>{String(p.estado_pago || '').toLowerCase()}</span></td>
              <td className="fp-notas">
                {p.notas_tesoreria || ''}
                {p.comprobante_url && <> <a href={p.comprobante_url} target="_blank" rel="noreferrer">comprobante <ExternalLink size={11} /></a></>}
              </td>
              {puedeBorrar && (
                <td>
                  <button type="button" className="fp-borrar" onClick={() => onBorrar(p)} aria-label={`Borrar pago de ${p.meses_correspondientes || 'sin mes'}`} title="Borrar este pago">
                    <Trash2 size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FichaPersonaModal({
  persona, jugadores = [], cuentas = [], pagos = [], morosos = [], sociosMorosos = [],
  onCerrar, onAbrir, onEditar, onRegistrarPago, puedeRegistrarPago = false,
  puedeBorrarPagos = false, onPagosCambiados,
}) {
  const [pestana, setPestana] = useState(persona?.pestana || 'datos');
  useModalAccesible(Boolean(persona), onCerrar);
  const esJugador = persona?.tipo === 'jugador';
  const raw = useMemo(() => persona?.raw || {}, [persona]);

  // Vínculos: pagador/apoderado de un deportista y pupilos de una cuenta.
  const cuentaDe = useMemo(() => {
    const porRut = new Map(cuentas.map((c) => [norm(c.rut), c]));
    const porCorreo = new Map(cuentas.filter((c) => correo(c.correo).includes('@')).map((c) => [correo(c.correo), c]));
    return (j) => porRut.get(norm(j.rut_apoderado)) || porCorreo.get(correo(j.correo_apoderado)) || null;
  }, [cuentas]);

  const apoderado = esJugador ? cuentaDe(raw) : null;
  const cuentaPropia = esJugador ? cuentas.find((c) => norm(c.rut) === norm(raw.rut_jugador)) : null;
  const pupilos = useMemo(() => (esJugador ? [] : jugadores.filter((j) => (
    (norm(j.rut_apoderado) && norm(j.rut_apoderado) === norm(raw.rut))
    || (correo(raw.correo).includes('@') && correo(j.correo_apoderado) === correo(raw.correo))
    || norm(j.rut_jugador) === norm(raw.rut)
  ))), [esJugador, jugadores, raw]);
  const hermanos = esJugador
    ? jugadores.filter((j) => j !== raw && (
      (norm(raw.rut_apoderado) && norm(j.rut_apoderado) === norm(raw.rut_apoderado))
      || (correo(raw.correo_apoderado).includes('@') && correo(j.correo_apoderado) === correo(raw.correo_apoderado))
    ))
    : [];

  // Cuota mensual con las tarifas del club (misma regla que Tesorería).
  const cuotaJugador = (j, familia, cuentaFamilia) => {
    const esSocio = Boolean(cuentaFamilia?.es_socio) || familia.some((p) => p.apoderado_socio);
    const { cuotaReferencial } = calcularCuotaDeportistasFamilia({
      pupilosFamilia: familia, esSocioApoderado: esSocio, montoAcordado: Number(cuentaFamilia?.monto_mensual_override || 0),
    });
    return { monto: obtenerCuotaJugador(j, cuotaReferencial), esSocio };
  };

  const filasMeses = useMemo(() => {
    if (!persona) return [];
    if (esJugador) return construirInformeDeportistas({ jugadores: [raw], morosos, pagos });
    const filas = [];
    if (raw.es_socio) filas.push({ titulo: 'Cuota de socio', fila: construirInformeSocios({ cuentas: [raw], sociosMorosos, pagos })[0] });
    construirInformeDeportistas({ jugadores: pupilos, morosos, pagos }).forEach((f) => filas.push({ titulo: `Mensualidad · ${f.nombre}`, fila: f }));
    return filas;
  }, [persona, esJugador, raw, morosos, sociosMorosos, pagos, pupilos]);

  const pagosPersona = useMemo(() => {
    const ruts = new Set(esJugador ? [norm(raw.rut_jugador)] : [norm(raw.rut), ...pupilos.map((p) => norm(p.rut_jugador))]);
    return pagos
      .filter((p) => ruts.has(norm(p.rut_jugador)) || (!esJugador && norm(p.rut_pagos) === norm(raw.rut)))
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [pagos, esJugador, raw, pupilos]);

  if (!persona) return null;

  const nombre = esJugador
    ? `${raw.nombres || ''} ${raw.apellido_paterno || ''} ${raw.apellido_materno || ''}`.replace(/\s+/g, ' ').trim()
    : `${raw.nombres || ''} ${raw.apellido_paterno || ''}`.trim();
  const rol = normalizarRol(raw.rol || raw.perfil_principal || '');
  const familia = esJugador ? [raw, ...hermanos] : pupilos;
  const cuota = esJugador ? cuotaJugador(raw, familia, apoderado) : null;
  const beca = esJugador ? obtenerPorcentajeBeca(raw) : 0;
  const chips = esJugador
    ? [
      raw.estado && String(raw.estado).toUpperCase() !== 'ACTIVO' ? raw.estado : null,
      raw.apoderado_socio || apoderado?.es_socio ? 'Pupilo de socio' : null,
      raw.exento_mensualidad ? 'Exento' : (beca > 0 ? `Beca ${beca}%` : null),
      !apoderado ? 'Sin cuenta de apoderado' : null,
    ].filter(Boolean)
    : [ETIQUETA_ROL[rol] || rol || 'Sin rol', raw.es_socio ? 'Socio' : null, pupilos.length ? `${pupilos.length} ${pupilos.length === 1 ? 'pupilo' : 'pupilos'}` : null].filter(Boolean);

  const pestanas = [
    { id: 'datos', label: 'Datos' },
    { id: 'pagos', label: `Pagos${pagosPersona.length ? ` (${pagosPersona.length})` : ''}` },
    { id: 'vinculos', label: esJugador ? 'Apoderado y hermanos' : `Pupilos (${pupilos.length})` },
  ];

  return createPortal(
    <div className="fp-fondo" onClick={onCerrar} role="presentation">
      <div className="fp-ventana" role="dialog" aria-modal="true" aria-labelledby="fp-titulo" onClick={(e) => e.stopPropagation()}>
        <header className="fp-cabecera">
          <span className="tc-avatar" aria-hidden="true">{esJugador ? <User size={18} /> : <Users size={18} />}</span>
          <div className="fp-cabecera-texto">
            <h3 id="fp-titulo">{nombre || 'Sin nombre'}</h3>
            <p>{esJugador ? `Deportista · ${raw.rut_jugador || ''}` : `Cuenta · ${raw.rut || ''}`}</p>
            <div className="tc-perfiles">
              {chips.map((c) => <span key={c} className={`tc-perfil ${c.startsWith('Sin cuenta') ? 'alerta' : ''}`}>{c}</span>)}
            </div>
          </div>
          <button type="button" className="fp-cerrar" onClick={onCerrar} aria-label="Cerrar ficha"><X size={20} /></button>
        </header>

        <div className="segment-control fp-pestanas" role="tablist">
          {pestanas.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={pestana === p.id} className={`segment-btn ${pestana === p.id ? 'active' : ''}`} onClick={() => setPestana(p.id)}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="fp-cuerpo">
          {pestana === 'datos' && (esJugador ? (
            <div className="fp-datos">
              <Dato etiqueta="Nacimiento" valor={raw.fecha_nacimiento ? `${fecha(raw.fecha_nacimiento)}${edad(raw.fecha_nacimiento) !== null ? ` (${edad(raw.fecha_nacimiento)} años)` : ''}` : 'Sin fecha'} />
              <Dato etiqueta="Rama" valor={raw.rama} />
              <Dato etiqueta="Categoría" valor={raw.categoria} />
              <Dato etiqueta="Estado" valor={raw.estado || 'ACTIVO'} />
              <Dato etiqueta="Ingreso" valor={fecha(raw.fecha_ingreso)} />
              <Dato etiqueta="Cobra desde" valor={raw.mes_inicio_cobro} />
              <Dato
                etiqueta="Cuota mensual"
                valor={noDebeMensualidad(raw) ? '$0 (no paga)' : `${pesos(cuota.monto)}${Number(raw.valor_mensualidad) > 0 ? ' (monto propio)' : cuota.esSocio ? ' (hijo de socio)' : familia.length > 1 ? ' (hermanos)' : ''}`}
              />
              <Dato etiqueta="Correo apoderado" valor={raw.correo_apoderado} />
              <Dato etiqueta="Parentesco" valor={raw.parentesco_apoderado} />
              <Dato etiqueta="Correo deportista" valor={raw.correo_jugador} />
              <Dato etiqueta="Colegio" valor={raw.colegio} />
              <Dato etiqueta="Posición" valor={raw.posicion_de_juego} />
              <Dato etiqueta="N° camiseta" valor={raw.numero_camiseta} />
              <Dato etiqueta="Previsión" valor={raw.prevision} />
              <Dato etiqueta="Emergencia" valor={[raw.nombre_emergencia, raw.parentesco_emergencia, raw.num_emergencia].filter(Boolean).join(' · ')} />
              <Dato etiqueta="Cuenta propia" valor={cuentaPropia ? 'Sí (ingresa con su RUT)' : 'No'} />
            </div>
          ) : (
            <div className="fp-datos">
              <Dato etiqueta="Perfil" valor={ETIQUETA_ROL[rol] || rol || 'Sin rol'} />
              <Dato etiqueta="Estado" valor={raw.estado || 'activo'} />
              <Dato etiqueta="Correo" valor={raw.correo} />
              <Dato etiqueta="Teléfono" valor={raw.telefono ? `${raw.prefijo_tel || '+56'} ${raw.telefono}` : ''} />
              <Dato etiqueta="Dirección" valor={[raw.direccion, raw.comuna].filter(Boolean).join(', ')} />
              <Dato etiqueta="Socio" valor={raw.es_socio ? `Sí${raw.fecha_ingreso_socio ? ` · desde ${fecha(raw.fecha_ingreso_socio)}` : ''}` : 'No'} />
              <Dato etiqueta="Cuota socio fija" valor={Number(raw.monto_mensual_base) > 0 ? pesos(raw.monto_mensual_base) : ''} />
              <Dato etiqueta="Monto acordado familia" valor={Number(raw.monto_mensual_override) > 0 ? pesos(raw.monto_mensual_override) : ''} />
              <Dato etiqueta="Condiciones de pago" valor={raw.condiciones_pago} />
            </div>
          ))}

          {pestana === 'pagos' && (
            <>
              {esJugador
                ? <GrillaMeses titulo="Mensualidad 2026" fila={filasMeses[0]} />
                : filasMeses.map((g) => <GrillaMeses key={g.titulo} titulo={g.titulo} fila={g.fila} />)}
              {!esJugador && filasMeses.length === 0 && <p className="tc-vacio">Esta cuenta no paga cuotas (no es socia ni tiene pupilos).</p>}
              <h4 className="fp-subtitulo">Historial de pagos</h4>
              <TablaPagos
                pagos={pagosPersona}
                puedeBorrar={puedeBorrarPagos}
                onBorrar={async (p) => {
                  const confirmado = await confirmAction({
                    title: 'Borrar pago',
                    message: `Se borrará el pago de ${p.meses_correspondientes || 'sin mes'} (${p.concepto_pago || 'Mensualidad'}, $${Math.round(Number(p.monto_total_pagado) || 0).toLocaleString('es-CL')}). Esta acción no se puede deshacer y queda registrada en la auditoría.`,
                    confirmText: 'Borrar pago',
                  });
                  if (!confirmado) return;
                  try {
                    await api.pagosMensualidadesAPI.eliminar(p.id);
                    showToast({ message: 'Pago borrado.', type: 'success' });
                    await onPagosCambiados?.();
                  } catch (error) {
                    showToast({ message: error.message || 'No se pudo borrar el pago.', type: 'error' });
                  }
                }}
              />
            </>
          )}

          {pestana === 'vinculos' && (esJugador ? (
            <div className="fp-vinculos">
              <h4 className="fp-subtitulo">Apoderado</h4>
              {apoderado ? (
                <button type="button" className="fp-vinculo" onClick={() => onAbrir({ tipo: 'cuenta', raw: apoderado })}>
                  <Users size={15} /> {`${apoderado.nombres || ''} ${apoderado.apellido_paterno || ''}`.trim()} · {apoderado.rut}{apoderado.es_socio ? ' · socio' : ''}
                </button>
              ) : (
                <p className="fp-ayuda">Sin cuenta de apoderado vinculada{raw.correo_apoderado ? ` (correo registrado: ${raw.correo_apoderado})` : ''}. Vincúlala con “Asignar apoderado” o “Modificar”.</p>
              )}
              <h4 className="fp-subtitulo">Hermanos</h4>
              {hermanos.length ? hermanos.map((h) => (
                <button key={h.rut_jugador} type="button" className="fp-vinculo" onClick={() => onAbrir({ tipo: 'jugador', raw: h })}>
                  <User size={15} /> {`${h.nombres || ''} ${h.apellido_paterno || ''}`.trim()} · {h.categoria || ''}
                </button>
              )) : <p className="fp-ayuda">Sin hermanos vinculados.</p>}
            </div>
          ) : (
            <div className="fp-vinculos">
              {pupilos.length ? pupilos.map((p) => (
                <button key={p.rut_jugador} type="button" className="fp-vinculo" onClick={() => onAbrir({ tipo: 'jugador', raw: p })}>
                  <User size={15} /> {`${p.nombres || ''} ${p.apellido_paterno || ''}`.trim()} · {p.rut_jugador} · {[p.rama, p.categoria].filter(Boolean).join(' ')}
                </button>
              )) : <p className="fp-ayuda">Esta cuenta no tiene pupilos vinculados.</p>}
            </div>
          ))}
        </div>

        <footer className="fp-pie">
          {puedeRegistrarPago && (esJugador || raw.es_socio) && (
            <button
              type="button"
              className="btn-secondary tc-btn"
              onClick={() => onRegistrarPago(esJugador ? { modoPago: 'deportista', rut: raw.rut_jugador } : { modoPago: 'socio', rut: raw.rut })}
            >
              <Plus size={13} /> Registrar pago
            </button>
          )}
          <button type="button" className="btn-electric tc-btn" onClick={() => onEditar(persona)}>
            <Pencil size={13} /> Editar ficha
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}

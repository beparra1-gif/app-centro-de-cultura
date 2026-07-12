import { useState } from 'react';
import { AlertTriangle, Camera, Clock, LayoutGrid, List } from 'lucide-react';
import { nextId } from '../utils/runtimeId';
import { getUTMLastDayPreviousMonth } from '../utils/appHelpers';
import * as api from '../api/client';
import LogoAvatar from './LogoAvatar';

function PerfilTesoreriaPanel({
  pupiloActivo,
  pupilosDisponibles,
  cuentasAdmin,
  pagosMensualidadesAdmin,
  morososAdmin,
  mesesSeleccionados,
  setMesesSeleccionados,
  tipoPago,
  setTipoPago,
  montoAbono,
  setMontoAbono,
  comprobanteSubido,
  setComprobanteSubido,
  setPagosPendientesAdmin,
  pagoViewMode,
  setPageViewMode,
}) {
  const [archivoComprobante, setArchivoComprobante] = useState(null);
  const [subiendoComprobante, setSubiendoComprobante] = useState(false);
  const [errorComprobante, setErrorComprobante] = useState('');

  const mesesBase = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const cuentaActual = Array.isArray(cuentasAdmin)
    ? cuentasAdmin.find((cuenta) => {
      const correoCuenta = String(cuenta.correo || '').trim().toLowerCase();
      const correoApoderado = String(pupiloActivo?.correo_apoderado || '').trim().toLowerCase();
      return correoCuenta && correoApoderado && correoCuenta === correoApoderado;
    }) || cuentasAdmin[0] || null
    : null;
  const pupilosActivos = Array.isArray(pupilosDisponibles) && pupilosDisponibles.length > 0
    ? pupilosDisponibles
    : (pupiloActivo ? [pupiloActivo] : []);
  const rutPupiloActivo = pupiloActivo?.rut || pupilosActivos[0]?.rut;
  const titular = cuentaActual
    ? `${cuentaActual.nombres || ''} ${cuentaActual.apellido_paterno || ''}`.trim()
    : (pupiloActivo?.nombre || pupilosActivos[0]?.nombre || 'Cuenta principal');
  const perfilPrincipal = String(cuentaActual?.perfil_principal || cuentaActual?.rol || '').toLowerCase();
  const esSocio = Boolean(cuentaActual?.es_socio) || ['socio', 'socio_apoderado', 'directiva'].includes(perfilPrincipal);
  const esSocioApoderado = perfilPrincipal === 'socio_apoderado';

  const morosoActivo = (morososAdmin || []).find((m) => m.rut === rutPupiloActivo) || null;
  const mesesAtraso = Number(morosoActivo?.mesesDeuda || 0);
  const estadoCuenta = mesesAtraso > 0 ? 'Moroso' : 'Al Día';

  const monthFromPago = (pago) => {
    if (Number.isFinite(Number(pago.mes_pago_numero))) return Number(pago.mes_pago_numero);

    if (typeof pago.meses_correspondientes === 'string' && pago.meses_correspondientes.trim()) {
      const token = pago.meses_correspondientes.trim().split(/\s+/)[0].toLowerCase().slice(0, 3);
      const idx = mesesBase.findIndex((m) => m.toLowerCase() === token);
      if (idx >= 0) return idx + 1;
    }

    if (typeof pago.mes_pagado === 'string' && pago.mes_pagado.length >= 3) {
      const normalized = pago.mes_pagado.slice(0, 3).toLowerCase();
      const idx = mesesBase.findIndex((m) => m.toLowerCase() === normalized);
      return idx >= 0 ? idx + 1 : null;
    }
    return null;
  };

  const pagosJugador = (pagosMensualidadesAdmin || []).filter((p) => {
    if (!rutPupiloActivo) return true;
    return p.rut_jugador === rutPupiloActivo;
  });

  const pagosPorMes = pagosJugador.reduce((acc, pago) => {
    const mes = monthFromPago(pago);
    if (!mes) return acc;
    const estado = (pago.estado_pago || '').toLowerCase();
    if (!acc[mes]) acc[mes] = [];
    acc[mes].push(estado);
    return acc;
  }, {});

  const mesActual = new Date().getMonth() + 1;
  const mesesVisuales = mesesBase.map((mes, idx) => {
    const mesNumero = idx + 1;
    const estadosMes = pagosPorMes[mesNumero] || [];
    const estado = estadosMes.includes('aprobado')
      ? 'pagado'
      : (estadosMes.includes('pendiente') || estadosMes.includes('rechazado'))
        ? 'pendiente'
        : (mesNumero < mesActual ? 'pendiente' : 'futuro');

    return { id: mesNumero, mes, estado };
  });

  const cantidadPupilos = pupilosActivos.length;
  const now = new Date();
  const fechaCorte = new Date(now.getFullYear(), now.getMonth(), 0);
  const fechaCorteTexto = fechaCorte.toLocaleDateString('es-CL');

  const utmActual = Number(cuentaActual?.utm_valor_referencia || getUTMLastDayPreviousMonth(71506));
  const cuotaSocioBase = Number(cuentaActual?.monto_mensual_base || 0);
  const cuotaSocio = Math.round(cuotaSocioBase > 0 ? cuotaSocioBase : (utmActual * 0.3));

  const calcularCuotaDeportistas = () => {
    if (cantidadPupilos <= 0) return 0;

    // Excepción acordada/beca: aplica solo a la parte deportistas, nunca a la cuota socio.
    const cuotaAcordada = Number(cuentaActual?.monto_mensual_override || 0);
    if (Number.isFinite(cuotaAcordada) && cuotaAcordada > 0) return cuotaAcordada;

    if (esSocioApoderado) {
      if (cantidadPupilos === 1) return 15000;
      // Desde 2 pupilos: 12.000 c/u y el 3ro gratis (tope 24.000).
      return 24000;
    }

    // Apoderado sin membresía socio: 30.000 (1 pupilo), 25.000 c/u desde 2.
    if (cantidadPupilos === 1) return 30000;
    return 25000 * cantidadPupilos;
  };

  const cuotaDeportistas = calcularCuotaDeportistas();
  const cuotaSocioAplicada = esSocio ? cuotaSocio : 0;
  const tarifaMensual = cuotaSocioAplicada + cuotaDeportistas;
  const cuotaDeportistaReferencial = cantidadPupilos > 0 ? Math.round(cuotaDeportistas / cantidadPupilos) : cuotaDeportistas;
  const condicionesPagoPerfil = String(cuentaActual?.condiciones_pago || '').trim();

  const tarifaRedondeada = Math.round(tarifaMensual);
  const totalSeleccionado = tarifaRedondeada * mesesSeleccionados.length;
  const totalFinalPagar = tipoPago === 'completo' ? totalSeleccionado : (Number(montoAbono) || 0);

  const toggleMes = (idMes, estado) => {
    if (estado === 'pagado') return;
    if (!['pendiente', 'futuro'].includes(estado)) return;
    if (mesesSeleccionados.includes(idMes)) {
      setMesesSeleccionados(mesesSeleccionados.filter(m => m !== idMes));
    } else {
      setMesesSeleccionados([...mesesSeleccionados, idMes]);
    }
  };

  const construirNombrePupilo = (pupilo = {}) => {
    return (
      `${pupilo.nombres || ''} ${pupilo.apellido_paterno || ''} ${pupilo.apellido_materno || ''}`.trim()
      || pupilo.nombre
      || 'Deportista'
    );
  };

  const obtenerAnioPupilo = (pupilo = {}) => {
    return (
      pupilo.anioNacimiento
      || pupilo.anio_nacimiento
      || pupilo.ano_nacimiento
      || pupilo['año_nacimiento']
      || pupilo['a├▒o_nacimiento']
      || ''
    );
  };

  const convertirArchivoABase64 = (archivo) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(archivo);
  });

  const enviarComprobantePago = async () => {
    if (mesesSeleccionados.length === 0) {
      setErrorComprobante('Selecciona al menos un mes para registrar el pago.');
      return;
    }

    if (!archivoComprobante) {
      setErrorComprobante('Debes adjuntar un comprobante (imagen o PDF).');
      return;
    }

    const monto = Number(totalFinalPagar || 0);
    if (!Number.isFinite(monto) || monto <= 0) {
      setErrorComprobante('El monto a transferir debe ser mayor a cero.');
      return;
    }

    try {
      setSubiendoComprobante(true);
      setErrorComprobante('');

      let comprobanteUrl = '';
      if (String(archivoComprobante.type || '').startsWith('image/')) {
        const formData = new FormData();
        formData.append('nombre', `comprobante-${rutPupiloActivo || Date.now()}`);
        formData.append('tipo', 'comprobante');
        formData.append('archivo', archivoComprobante);
        const uploadRes = await api.assetsAPI.uploadLogo(formData);
        comprobanteUrl = uploadRes?.url || '';
      } else {
        comprobanteUrl = await convertirArchivoABase64(archivoComprobante);
      }

      const mesesTexto = [...mesesSeleccionados]
        .sort((a, b) => a - b)
        .map((mesNumero) => mesesBase[mesNumero - 1])
        .filter(Boolean)
        .join(', ');

      const payload = {
        rut_jugador: rutPupiloActivo,
        correo_apoderado: cuentaActual?.correo || pupiloActivo?.correo_apoderado || '',
        concepto_pago: tipoPago === 'abono' ? 'Abono mensualidad' : 'Pago mensualidades',
        cantidad_meses_pagados: mesesSeleccionados.length,
        meses_correspondientes: mesesTexto,
        monto_total_pagado: monto,
        comprobante_url: comprobanteUrl,
      };

      const pagoCreado = await api.pagosMensualidadesAPI.create(payload);

      setComprobanteSubido(true);
      setPagosPendientesAdmin((prev) => [
        ...(Array.isArray(prev) ? prev : []),
        pagoCreado || {
          id: nextId(),
          familia: titular,
          rut_jugador: rutPupiloActivo,
          monto,
          detalle: `${payload.concepto_pago} — ${mesesSeleccionados.length} mes(es) — Comprobante adjunto`,
          estado_pago: 'pendiente',
        },
      ]);
    } catch (error) {
      setErrorComprobante(error.message || 'No se pudo enviar el comprobante.');
    } finally {
      setSubiendoComprobante(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="status-account-card payment-overview-card mt-15" style={{ borderRadius: '28px', boxShadow: '0 16px 34px rgba(15,23,42,0.10)' }}>
        <div className="status-header">
          <div>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mensualidad / Perfil</span>
            <h3 className="status-titular" style={{ color: 'white' }}>{titular}</h3>
            <span className="status-rol">{esSocio ? 'Socio Activo Club Cultura Física' : 'Apoderado Base'}</span>
            {esSocio && (
              <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700', display: 'block', marginTop: '5px' }}>
                UTM referencia ({fechaCorteTexto}): ${utmActual.toLocaleString('es-CL')} · Cuota socio automática: ${cuotaSocio.toLocaleString('es-CL')}
              </span>
            )}
          </div>
          <div className={`status-badge ${estadoCuenta === 'Al Día' ? 'ok' : 'moroso'}`}>
            {estadoCuenta}
          </div>
        </div>
        {estadoCuenta === 'Moroso' && (
          <div className="status-alert"><AlertTriangle size={16} color="#6B7280" strokeWidth={1.5} /> Presenta {mesesAtraso} meses de atraso en cuotas.</div>
        )}
      </div>

      {pupilosActivos.length > 0 && (
        <div className="card mt-15 fade-in" style={{ borderRadius: '22px', padding: '12px' }}>
          <h4 style={{ margin: '2px 4px 10px 4px', fontSize: '13px', fontWeight: '900', color: 'var(--texto-heading)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {pupilosActivos.length > 1 ? 'Deportistas a cargo' : 'Deportista a cargo'}
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px' }}>
            {pupilosActivos.map((pupilo) => {
              const nombreCompleto = construirNombrePupilo(pupilo);
              const anio = obtenerAnioPupilo(pupilo);
              const categoria = String(pupilo.categoria || 'General');

              return (
                <div key={`pupilo-card-${pupilo.rut || pupilo.id}`} style={{ border: '1px solid var(--borde-suave)', borderRadius: '16px', padding: '10px', background: 'linear-gradient(180deg, #fff 0%, #f8fbff 100%)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <LogoAvatar
                      nombre={nombreCompleto}
                      logoUrl={pupilo.foto_jugador || pupilo.foto_perfil_url || ''}
                      size={52}
                      borderRadius="14px"
                    />
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', fontSize: '13px', color: 'var(--texto-principal)', lineHeight: '1.2' }}>{nombreCompleto}</strong>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700', marginTop: '3px' }}>{categoria}{anio ? ` · ${anio}` : ''}</span>
                      <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: 'var(--azul-marino)', fontWeight: '800' }}>Cuota vigente: ${cuotaDeportistaReferencial.toLocaleString('es-CL')} / mes</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {estadoCuenta === 'Moroso' && (
        <div className="card fade-in mt-15 compact-debt-summary" style={{ borderLeft: '4px solid var(--rojo-alerta)', background: 'linear-gradient(180deg, rgba(255,59,48,0.08), rgba(255,59,48,0.02))', borderRadius: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'center' }}>
            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--rojo-alerta)', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={18} color="#6B7280" strokeWidth={1.5} /> Deuda Pendiente</h4>
              <p style={{ margin: '0', fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '700' }}>{mesesAtraso} {mesesAtraso === 1 ? 'mes' : 'meses'} adeudados</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Total Estimado</span>
              <strong style={{ fontSize: '20px', color: 'var(--rojo-alerta)', fontWeight: '900' }}>-${(tarifaRedondeada * mesesAtraso).toLocaleString('es-CL')}</strong>
            </div>
          </div>
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,59,48,0.15)', fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
            <span>Cuota mensual: <strong style={{ color: 'var(--texto-principal)' }}>${tarifaRedondeada.toLocaleString('es-CL')}</strong></span>
          </div>
        </div>
      )}

      <h3 className="section-title mt-20">Panel de Pagos 2026</h3>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          className={`btn-toggle-view ${pagoViewMode === 'grid' ? 'activo' : ''}`}
          onClick={() => setPageViewMode('grid')}
          title="Vista Cuadrícula"
          style={{ padding: '9px 14px', borderRadius: '999px', border: '1px solid var(--borde-suave)', background: pagoViewMode === 'grid' ? 'linear-gradient(180deg, #2f8cff 0%, var(--azul-electrico) 100%)' : 'rgba(255,255,255,0.9)', color: pagoViewMode === 'grid' ? 'white' : 'var(--texto-principal)', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.3s ease' }}
        >
          <LayoutGrid size={16} /> Cuadrícula
        </button>
        <button
          className={`btn-toggle-view ${pagoViewMode === 'list' ? 'activo' : ''}`}
          onClick={() => setPageViewMode('list')}
          title="Vista Lista"
          style={{ padding: '9px 14px', borderRadius: '999px', border: '1px solid var(--borde-suave)', background: pagoViewMode === 'list' ? 'linear-gradient(180deg, #2f8cff 0%, var(--azul-electrico) 100%)' : 'rgba(255,255,255,0.9)', color: pagoViewMode === 'list' ? 'white' : 'var(--texto-principal)', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.3s ease' }}
        >
          <List size={16} /> Lista Compacta
        </button>
      </div>

      <div className="card finanzas-card payment-card" style={{ borderRadius: '22px', padding: '14px' }}>
        {esSocio && (
          <div className="mb-20">
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--texto-heading)', fontWeight: '800' }}>1. Cuotas de Socio: <span className="payment-chip">Socio activo</span></h4>
            <div className={pagoViewMode === 'grid' ? 'grid-12-meses' : 'lista-12-meses'}>
              {mesesVisuales.map((item) => (
                <div key={item.id} onClick={() => toggleMes(item.id, item.estado)} className={`mes-box mes-${item.estado} ${mesesSeleccionados.includes(item.id) ? 'seleccionado' : ''}`}>
                  <span className="mes-box-nombre">{item.mes}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {pupilosActivos.map(pupilo => (
          <div key={pupilo.id} className="mb-15" style={{ borderTop: '1px dashed rgba(0,0,0,0.1)', paddingTop: '10px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--texto-heading)', fontWeight: '800' }}>2. Mensualidad Deportista: {pupilo.nombre.split(' ')[0]} <span className="payment-chip">Inscripción</span></h4>
            <div className={pagoViewMode === 'grid' ? 'grid-12-meses' : 'lista-12-meses'}>
              {mesesBase.map((mes, idx) => {
                const mesNumero = idx + 1;
                const pagosDelPupilo = (pagosMensualidadesAdmin || []).filter((p) => p.rut_jugador === pupilo.rut);
                const estadosMes = pagosDelPupilo
                  .filter((pago) => monthFromPago(pago) === mesNumero)
                  .map((pago) => (pago.estado_pago || '').toLowerCase());
                const estadoMes = (estadosMes.includes('aprobado') || estadosMes.includes('validado'))
                  ? 'pagado'
                  : (estadosMes.includes('pendiente') || estadosMes.includes('rechazado'))
                    ? 'pendiente'
                    : (mesNumero < mesActual ? 'pendiente' : 'futuro');

                return (
                <div
                  key={mesNumero + pupilo.id}
                  onClick={() => toggleMes(mesNumero, estadoMes)}
                  className={`mes-box mes-${estadoMes} ${mesesSeleccionados.includes(mesNumero) ? 'seleccionado' : ''}`}
                  style={{ cursor: estadoMes === 'pagado' ? 'not-allowed' : 'pointer' }}
                >
                  <span className="mes-box-nombre">{mes}</span>
                </div>
                );
              })}
            </div>
          </div>
        ))}

        {!comprobanteSubido && (
          <div className="dynamic-checkout-box fade-in mt-15" style={{ padding: '16px', borderRadius: '18px' }}>
            <h4 className="form-subtitle">Resumen de Liquidación</h4>
            <div className="checkbox-grid mb-15">
              {esSocio && cuotaSocioAplicada > 0 && (
                <label className="checkbox-item"><input type="checkbox" checked readOnly /> Pago Cuota Socio</label>
              )}
              <label className="checkbox-item"><input type="checkbox" checked readOnly /> Pago Cuota Deportista</label>
            </div>

            <div className="desglose-row"><span>Valor mensual perfil:</span><strong>${tarifaRedondeada.toLocaleString('es-CL')} / mes</strong></div>
            {esSocio && cuotaSocioAplicada > 0 && (
              <div className="desglose-row"><span>Detalle cuota socio:</span><strong>${cuotaSocioAplicada.toLocaleString('es-CL')}</strong></div>
            )}
            <div className="desglose-row"><span>Detalle cuota deportista(s):</span><strong>${cuotaDeportistas.toLocaleString('es-CL')}</strong></div>
            <div className="desglose-row total-calc"><span>Total a Pagar ({mesesSeleccionados.length} meses):</span><strong>${totalSeleccionado.toLocaleString('es-CL')}</strong></div>

            {mesesSeleccionados.length === 0 && (
              <div style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700', marginTop: '6px' }}>
                Selecciona meses pendientes o futuros para calcular y enviar la liquidación.
              </div>
            )}

            {condicionesPagoPerfil && (
              <div style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700', marginBottom: '10px' }}>
                Condiciones perfil: {condicionesPagoPerfil}
              </div>
            )}

            <div className="tipo-pago-grid mb-15 mt-15" style={{ display: 'flex', gap: '10px' }}>
              <button className={`btn-metodo-pago ${tipoPago === 'completo' ? 'activo' : ''}`} onClick={() => setTipoPago('completo')}>Pago Mensualidades</button>
              <button className={`btn-metodo-pago ${tipoPago === 'abono' ? 'activo' : ''}`} onClick={() => setTipoPago('abono')}>Abono Parcial</button>
            </div>

            {tipoPago === 'abono' && (
              <div className="input-group mb-15">
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Monto a abonar (CLP)</label>
                <input type="number" className="form-input mt-5" value={montoAbono} onChange={(e) => setMontoAbono(e.target.value)} placeholder="Ej: 15000" />
              </div>
            )}

            <div className="checkout-total-box mt-10" style={{ padding: '20px 16px', borderRadius: '18px' }}>
              <span>Monto a Transferir</span>
              <h2 style={{ fontSize: '38px' }}>${totalFinalPagar.toLocaleString('es-CL')}</h2>
            </div>
            <div style={{ marginTop: '10px', border: '1px solid rgba(0,122,255,0.2)', borderRadius: '14px', padding: '12px', background: 'linear-gradient(180deg, rgba(0,122,255,0.07), rgba(0,122,255,0.02))' }}>
              <label style={{ fontSize: '12px', fontWeight: '900', display: 'block', marginBottom: '8px' }}>Subir comprobante (foto, imagen o archivo)</label>
              <input
                type="file"
                className="form-input"
                accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                onChange={(e) => setArchivoComprobante(e.target.files?.[0] || null)}
              />
              <span style={{ display: 'block', marginTop: '6px', fontSize: '11px', color: 'var(--texto-secundario)' }}>
                Puedes subir JPG, PNG, WEBP o PDF (máx recomendado 5MB).
              </span>
              {archivoComprobante && (
                <span style={{ display: 'block', marginTop: '6px', fontSize: '11px', color: 'var(--azul-electrico)', fontWeight: '700' }}>
                  Archivo seleccionado: {archivoComprobante.name}
                </span>
              )}

              {errorComprobante && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--rojo-alerta)', fontWeight: '700' }}>
                  {errorComprobante}
                </div>
              )}

              <button
                className="btn-pago-cta mt-10"
                style={{ width: '100%', border: 'none', cursor: subiendoComprobante ? 'wait' : 'pointer', opacity: subiendoComprobante ? 0.8 : 1, padding: '14px 16px', borderRadius: '14px' }}
                onClick={enviarComprobantePago}
                disabled={subiendoComprobante || mesesSeleccionados.length === 0}
              >
                <Camera size={24} color="#6B7280" strokeWidth={1.5} />
                <div>
                  <strong style={{ display: 'block', fontSize: '14px' }}>{subiendoComprobante ? 'Enviando comprobante...' : 'Adjuntar y Enviar Comprobante'}</strong>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>Tesorería validará y marcará en verde los meses aprobados.</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {comprobanteSubido && (
          <div className="fade-in text-center py-20 mt-20 review-card">
            <Clock size={40} color="#6B7280" strokeWidth={1.5} style={{ margin: '0 auto' }} />
            <h3 style={{ color: '#FF9500', margin: '15px 0 10px 0', fontSize: '20px', fontWeight: '900' }}>Pago en Revisión</h3>
            <p style={{ fontSize: '14px', margin: 0, color: 'var(--texto-secundario)', lineHeight: '1.5' }}>Tesorería ha recibido tu comprobante. Será validado a la brevedad y recibirás una notificación.</p>
            <button className="btn-secondary mt-20" style={{ color: '#FF9500', background: 'rgba(255,149,0,0.1)' }} onClick={() => { setComprobanteSubido(false); setMesesSeleccionados([]); setMontoAbono(''); setArchivoComprobante(null); setErrorComprobante(''); }}>
              Entendido, volver
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default PerfilTesoreriaPanel;

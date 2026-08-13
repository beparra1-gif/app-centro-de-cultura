import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Search, ClipboardList, Check, Pin, Lightbulb } from 'lucide-react';
import * as api from '../api/client.js';
import { calcularCuotaFinal } from '../utils/beca';
import { confirmAction } from '../utils/confirmDialog';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_ABREV = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Valores de referencia para concepto de pago
const VALORES_CONCEPTO = {
  'Mensualidad': 25000,
  'Mensualidad Socio': 15000,
  'Matrícula': 50000
};

const normalizarRutPago = (rut = '') => String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();

const DIACRITICOS_REGEX = new RegExp('[̀-ͯ]', 'g');
const getMesNumeroDesdeTexto = (texto = '') => {
  const token = String(texto || '').trim().toLowerCase().normalize('NFD').replace(DIACRITICOS_REGEX, '').slice(0, 3);
  const idx = MESES_ABREV.findIndex((m) => m.toLowerCase() === token);
  return idx >= 0 ? idx + 1 : null;
};

// Igual que parseMesesDePago (App.jsx): expande rangos de texto legacy
// ("Enero-Marzo 2026") a la lista de meses que cubren — un pago manual
// nuevo nunca vuelve a guardar un rango (ver handleSubmit), pero pagos ya
// existentes (migrados o de antes de este fix) sí pueden traerlo, y no
// queremos que esos meses se vean como "sin pagar" solo porque el texto
// no es un mes único.
const expandirMesesDePago = (textoMeses = '', anioObjetivo) => {
  const texto = String(textoMeses || '').trim();
  if (!texto) return [];
  const anioMatch = texto.match(/(20\d{2})/);
  const anio = anioMatch ? Number(anioMatch[1]) : anioObjetivo;
  if (anio !== anioObjetivo) return [];

  const partes = texto.replace(/20\d{2}/g, '').replace(/[,]/g, ' ').split(/\s+/).map((p) => p.trim()).filter(Boolean);
  const candidatos = [];
  partes.forEach((parte) => {
    if (parte.includes('-')) {
      const [inicio, fin] = parte.split('-');
      const mIni = getMesNumeroDesdeTexto(inicio);
      const mFin = getMesNumeroDesdeTexto(fin);
      if (mIni && mFin && mIni <= mFin) {
        for (let m = mIni; m <= mFin; m += 1) candidatos.push(m);
        return;
      }
    }
    const mes = getMesNumeroDesdeTexto(parte);
    if (mes) candidatos.push(mes);
  });
  return [...new Set(candidatos)];
};

export default function PagoForm({ pago = null, jugadores = [], cuentas = [], pagosExistentes = [], onClose, onSave, autoAprobar = false, objetivoInicial = null }) {
  const [formData, setFormData] = useState({
    rut_jugador: pago?.rut_jugador || (objetivoInicial?.modoPago === 'deportista' ? objetivoInicial.rut : ''),
    correo_apoderado: pago?.correo_apoderado || '',
    concepto_pago: pago?.concepto_pago || 'Mensualidad',
    cantidad_meses_pagados: pago?.cantidad_meses_pagados || 1,
    meses_correspondientes: pago?.meses_correspondientes || '',
    monto_total_pagado: pago?.monto_total_pagado || '',
    comprobante_url: pago?.comprobante_url || '',
    notas_tesoreria: pago?.notas_tesoreria || ''
  });

  const [archivo, setArchivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [anioSeleccionado, setAnioSeleccionado] = useState(new Date().getFullYear());
  const [mesesSeleccionados, setMesesSeleccionados] = useState([]);
  // Monto propio por cada mes seleccionado (rut_mes -> monto). Antes un pago de
  // varios meses guardaba UN solo registro con meses_correspondientes como
  // rango de texto ("Junio-Julio 2026") y un monto total — pero el cálculo de
  // morosidad de Tesorería (monthFromPago en PerfilTesoreriaPanel) solo lee el
  // PRIMER mes de ese texto, así que el segundo mes seguía apareciendo impago
  // aunque el dinero ya estuviera registrado. Ahora cada mes se guarda como su
  // propio registro (ver handleSubmit), así ningún cálculo aguas abajo necesita
  // parsear rangos.
  const [montosPorMes, setMontosPorMes] = useState({});
  const [apoderadoAsignado, setApoderadoAsignado] = useState(null);

  // Modo "socio": permite registrar la cuota de un socio que no tiene ningún
  // deportista asociado — hoy ese socio es invisible para el sistema de
  // pagos porque todo el flujo exige elegir un deportista primero.
  const [modoPago, setModoPago] = useState(objetivoInicial?.modoPago || 'deportista'); // 'deportista' | 'socio'
  const [rutCuentaSocio, setRutCuentaSocio] = useState(objetivoInicial?.modoPago === 'socio' ? objetivoInicial.rut : '');
  const [searchTermSocio, setSearchTermSocio] = useState('');
  const [showSocioResults, setShowSocioResults] = useState(false);
  
  // Datos del jugador seleccionado
  const [valorMensualidad, setValorMensualidad] = useState(0);

  // Filtrar deportistas según búsqueda
  const deportistasFiltrados = searchTerm.trim() ? jugadores.filter(j => {
    const rut = (j.rut_jugador || '').toLowerCase();
    const nombres = (j.nombres || '').toLowerCase();
    const apellidos = `${j.apellido_paterno || ''} ${j.apellido_materno || ''}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    return rut.includes(search) || nombres.includes(search) || apellidos.includes(search);
  }) : [];

  // Cuentas con membresía de socio, para el modo "solo cuota de socio"
  const cuentasSocias = cuentas.filter(c => c.es_socio);
  const sociosFiltrados = searchTermSocio.trim() ? cuentasSocias.filter(c => {
    const rut = (c.rut || '').toLowerCase();
    const nombres = (c.nombres || '').toLowerCase();
    const apellidos = `${c.apellido_paterno || ''} ${c.apellido_materno || ''}`.toLowerCase();
    const search = searchTermSocio.toLowerCase();
    return rut.includes(search) || nombres.includes(search) || apellidos.includes(search);
  }) : [];

  const puedeContinuar = modoPago === 'deportista' ? Boolean(formData.rut_jugador) : Boolean(rutCuentaSocio);
  const montoTotalMeses = mesesSeleccionados.reduce((acc, idx) => acc + (Number(montosPorMes[idx]) || 0), 0);

  // Meses ya pagados (aprobado/validado) del deportista o socio elegido, para
  // el año en pantalla — un mes pagado queda bloqueado y en verde: solo se
  // pueden registrar manualmente meses morosos (impagos, ya vencidos) o
  // futuros que todavía no se pagan.
  const rutParaVerificarPagos = modoPago === 'socio' ? rutCuentaSocio : formData.rut_jugador;
  const mesesYaPagados = useMemo(() => {
    const rutNormalizado = normalizarRutPago(rutParaVerificarPagos);
    if (!rutNormalizado) return new Set();
    const pagados = new Set();
    (pagosExistentes || []).forEach((p) => {
      const estado = String(p.estado_pago || '').toLowerCase();
      if (estado !== 'aprobado' && estado !== 'validado') return;
      const coincideJugador = normalizarRutPago(p.rut_jugador) === rutNormalizado;
      const coincidePagador = normalizarRutPago(p.rut_pagos) === rutNormalizado;
      if (!coincideJugador && !coincidePagador) return;
      expandirMesesDePago(p.meses_correspondientes, anioSeleccionado).forEach((mes) => pagados.add(mes));
    });
    return pagados;
  }, [pagosExistentes, rutParaVerificarPagos, anioSeleccionado]);

  // Actualizar cuando se selecciona un deportista
  useEffect(() => {
    if (formData.rut_jugador) {
      const jugador = jugadores.find(j => j.rut_jugador === formData.rut_jugador);
      if (jugador) {
        // Traer valor de mensualidad (descontando % de beca o $0 si está exento)
        const mensualidad = calcularCuotaFinal(jugador.valor_mensualidad || 25000, jugador);
        setValorMensualidad(mensualidad);
        
        // Traer correo apoderado
        setFormData(prev => ({
          ...prev,
          correo_apoderado: jugador.correo_apoderado || ''
        }));

        // Buscar apoderado asignado
        const apoderado = cuentas.find(c => c.correo === jugador.correo_apoderado);
        setApoderadoAsignado(apoderado || null);

        // Determinar concepto automáticamente
        const esMatricula = !jugador.matricula_pagada;
        let conceptoAuto = 'Mensualidad';
        
        if (esMatricula) {
          conceptoAuto = 'Matrícula';
        } else if (apoderado?.es_socio) {
          conceptoAuto = 'Mensualidad Socio';
        }

        setFormData(prev => ({
          ...prev,
          concepto_pago: conceptoAuto
        }));

        // Resetear selección de meses
        setMesesSeleccionados([]);
        setMontosPorMes({});
      }
    }
  }, [formData.rut_jugador, jugadores, cuentas]);

  // Actualizar cuando se selecciona un socio sin deportista asociado (modo
  // "solo cuota de socio") — mismo patrón que el efecto de arriba, pero sin
  // depender de una ficha de jugador (no existe valor_mensualidad propio).
  useEffect(() => {
    if (modoPago !== 'socio' || !rutCuentaSocio) return;
    const cuentaSocio = cuentas.find(c => c.rut === rutCuentaSocio);
    if (!cuentaSocio) return;

    setValorMensualidad(VALORES_CONCEPTO['Mensualidad Socio']);
    setFormData(prev => ({
      ...prev,
      correo_apoderado: cuentaSocio.correo || '',
      concepto_pago: 'Mensualidad Socio',
    }));
    setMesesSeleccionados([]);
    setMontosPorMes({});
  }, [modoPago, rutCuentaSocio, cuentas]);

  // Actualizar meses_correspondientes cuando cambian meses seleccionados
  useEffect(() => {
    if (mesesSeleccionados.length > 0) {
      if (mesesSeleccionados.length === 1) {
        setFormData(prev => ({
          ...prev,
          meses_correspondientes: `${MESES[mesesSeleccionados[0]]} ${anioSeleccionado}`
        }));
      } else {
        const primerMes = MESES[mesesSeleccionados[0]];
        const ultimoMes = MESES[mesesSeleccionados[mesesSeleccionados.length - 1]];
        setFormData(prev => ({
          ...prev,
          meses_correspondientes: `${primerMes}-${ultimoMes} ${anioSeleccionado}`
        }));
      }
    }
  }, [mesesSeleccionados, anioSeleccionado]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'cantidad_meses_pagados' || name === 'monto_total_pagado'
        ? value ? Number(value) : ''
        : value
    }));
    setError('');
  };

  // Actualizar monto automáticamente cuando cambia valor_mensualidad o cantidad de meses
  const handleValorMensualidadChange = (e) => {
    const nuevoValor = Number(e.target.value) || 0;
    setValorMensualidad(nuevoValor);

    // Aplica el nuevo valor unitario a cada mes seleccionado — el admin puede
    // seguir ajustando el monto de un mes puntual después de esto.
    if (mesesSeleccionados.length > 0) {
      setMontosPorMes(
        Object.fromEntries(mesesSeleccionados.map((idx) => [idx, nuevoValor]))
      );
      if (mesesSeleccionados.length === 1) {
        setFormData(prev => ({ ...prev, monto_total_pagado: nuevoValor }));
      }
    }
    setError('');
  };

  const actualizarMontoMes = (idx, valor) => {
    const numero = valor === '' ? '' : Number(valor);
    setMontosPorMes(prev => ({ ...prev, [idx]: numero }));
    if (mesesSeleccionados.length === 1) {
      setFormData(prev => ({ ...prev, monto_total_pagado: numero }));
    }
  };

  const handleArchivoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Archivo muy grande. Máximo 5 MB');
        return;
      }
      setArchivo(file);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCargando(true);

    try {
      // Validar campos requeridos
      if (modoPago === 'deportista' && !formData.rut_jugador) throw new Error('Selecciona un deportista');
      if (modoPago === 'socio' && !rutCuentaSocio) throw new Error('Selecciona un socio');
      if (mesesSeleccionados.length === 0) throw new Error('Selecciona al menos un mes para pagar');

      // $0 es válido a propósito (ej. un mes que el club decide dejar sin
      // cobro puntual) — lo que se rechaza es vacío/negativo/no numérico, mes
      // por mes cuando hay más de uno seleccionado.
      for (const idx of mesesSeleccionados) {
        const montoMes = mesesSeleccionados.length === 1 ? formData.monto_total_pagado : montosPorMes[idx];
        if (montoMes === '' || montoMes === undefined || !Number.isFinite(Number(montoMes)) || Number(montoMes) < 0) {
          throw new Error(`Ingresa un monto válido para ${MESES[idx]} (puede ser $0)`);
        }
      }

      // rut_pagos identifica quién realmente paga (la cuenta), independiente
      // de si el pago va ligado a un deportista puntual o no — sin esto, un
      // pago de "solo cuota de socio" (rut_jugador vacío) queda huérfano y
      // ningún cálculo de morosidad puede atribuírselo a nadie.
      const rutPagosResuelto = modoPago === 'socio' ? rutCuentaSocio : (apoderadoAsignado?.rut || '');

      // Si hay archivo, convertir a base64 una sola vez — el mismo comprobante
      // respalda cada mes creado a continuación (un solo depósito puede cubrir
      // varios meses).
      let comprobanteUrlFinal = formData.comprobante_url;
      if (archivo) {
        const reader = new FileReader();
        comprobanteUrlFinal = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(archivo);
        });
      }

      if (pago?.id) {
        // Actualizar (siempre un único registro existente)
        await api.pagosMensualidadesAPI.update(pago.id, {
          ...formData,
          rut_pagos: rutPagosResuelto,
          comprobante_url: comprobanteUrlFinal,
        });
        setSuccess('Pago actualizado exitosamente');
      } else {
        // Crear: un registro POR CADA mes seleccionado, cada uno con su propio
        // monto y su propio mes en meses_correspondientes (nunca un rango de
        // texto) — así el cálculo de morosidad y el calendario de Tesorería,
        // que solo entienden un mes por registro, ven correctamente TODOS los
        // meses pagados y no solo el primero.
        const pagosACrear = mesesSeleccionados.map((idx) => ({
          rut_jugador: formData.rut_jugador,
          rut_pagos: rutPagosResuelto,
          correo_apoderado: formData.correo_apoderado,
          concepto_pago: formData.concepto_pago,
          cantidad_meses_pagados: 1,
          meses_correspondientes: `${MESES[idx]} ${anioSeleccionado}`,
          monto_total_pagado: Number(mesesSeleccionados.length === 1 ? formData.monto_total_pagado : montosPorMes[idx]),
          comprobante_url: comprobanteUrlFinal,
          notas_tesoreria: formData.notas_tesoreria,
        }));

        if (autoAprobar) {
          // Pago manual del superadmin: se salta la bandeja de validación, así
          // que pide confirmación explícita antes de dejarlo marcado como pagado.
          const totalConfirmar = pagosACrear.reduce((acc, p) => acc + p.monto_total_pagado, 0);
          const listaMeses = pagosACrear.map((p) => p.meses_correspondientes).join(', ');
          const confirmado = await confirmAction({
            title: 'Confirmar pago manual',
            message: `¿Confirmas registrar ${pagosACrear.length > 1 ? `estos ${pagosACrear.length} meses` : 'este pago'} como YA PAGADO por un total de $${totalConfirmar.toLocaleString('es-CL')} (${listaMeses})? Queda${pagosACrear.length > 1 ? 'n' : ''} aprobado${pagosACrear.length > 1 ? 's' : ''} de inmediato, sin pasar por la bandeja de validación.`,
            confirmText: 'Registrar y confirmar',
          });
          if (!confirmado) {
            setCargando(false);
            return;
          }
          for (const datosGuardar of pagosACrear) {
            const nuevoPago = await api.pagosMensualidadesAPI.create(datosGuardar);
            if (nuevoPago?.id) {
              await api.pagosMensualidadesAPI.validar(nuevoPago.id, 'aprobado');
            }
          }
          setSuccess(pagosACrear.length > 1 ? `${pagosACrear.length} meses registrados y confirmados.` : 'Pago registrado y confirmado.');
        } else {
          for (const datosGuardar of pagosACrear) {
            await api.pagosMensualidadesAPI.create(datosGuardar);
          }
          setSuccess(pagosACrear.length > 1 ? `${pagosACrear.length} meses creados exitosamente` : 'Pago creado exitosamente');
        }
      }

      setTimeout(() => {
        onSave();
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  // .ios-main tiene una transform permanente (clase screen-ready, ver
  // MesaControlPanel.jsx) que lo convierte en containing block de los
  // descendientes position:fixed, atrapando este overlay dentro del alto
  // scrolleable de la pestaña en vez de centrarlo en el viewport real. El
  // portal evita ese problema sin tocar la animacion global de .ios-main.
  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: 'var(--texto-heading)' }}>
            {pago?.id ? 'Editar Pago' : autoAprobar ? 'Pago Manual (Confirmado)' : 'Nuevo Pago'}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={24} color="var(--gris-secundario)" strokeWidth={1.5} />
          </button>
        </div>

        {!pago?.id && autoAprobar && (
          <div style={{
            background: 'rgba(0,122,255,0.08)',
            color: 'var(--azul-electrico)',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            Este pago queda aprobado de inmediato, sin pasar por la bandeja de validación.
          </div>
        )}

        {error && (
          <div style={{
            background: '#FFE5E5',
            color: '#CC0000',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '13px'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: '#E5FFE5',
            color: '#00CC00',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '13px'
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Modo: deportista (comportamiento de siempre) o solo cuota de socio
              (sin deportista asociado — ej. directiva o socio sin hijos) */}
          <div className="form-group">
            <label style={{ fontWeight: '600', fontSize: '13px' }}>Tipo de pago</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => { setModoPago('deportista'); setRutCuentaSocio(''); setSearchTermSocio(''); }}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                  border: modoPago === 'deportista' ? '2px solid var(--azul-electrico)' : '1px solid var(--borde)',
                  background: modoPago === 'deportista' ? 'rgba(0,122,255,0.08)' : 'white',
                  color: modoPago === 'deportista' ? 'var(--azul-electrico)' : 'var(--texto-primario)',
                }}
              >
                Deportista
              </button>
              <button
                type="button"
                onClick={() => { setModoPago('socio'); setFormData(prev => ({ ...prev, rut_jugador: '' })); setSearchTerm(''); }}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                  border: modoPago === 'socio' ? '2px solid var(--azul-electrico)' : '1px solid var(--borde)',
                  background: modoPago === 'socio' ? 'rgba(0,122,255,0.08)' : 'white',
                  color: modoPago === 'socio' ? 'var(--azul-electrico)' : 'var(--texto-primario)',
                }}
              >
                Solo cuota de socio
              </button>
            </div>
          </div>

          {/* Buscador Deportista */}
          {modoPago === 'deportista' && (
          <div className="form-group">
            <label style={{ fontWeight: '600', fontSize: '13px' }}>Deportista *</label>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                <Search size={16} color="var(--gris-secundario)" strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="Busca por nombre o RUT..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setShowSearchResults(true)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    paddingLeft: '32px',
                    borderRadius: '8px',
                    border: '1px solid var(--borde)',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              {showSearchResults && deportistasFiltrados.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'white',
                  border: '1px solid var(--borde)',
                  borderTopWidth: 0,
                  borderBottomLeftRadius: '8px',
                  borderBottomRightRadius: '8px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 1001,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  {deportistasFiltrados.map(j => (
                    <button
                      type="button"
                      key={j.rut_jugador}
                      onClick={() => {
                        setFormData(prev => ({ ...prev, rut_jugador: j.rut_jugador }));
                        setSearchTerm('');
                        setShowSearchResults(false);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        fontFamily: 'inherit',
                        padding: '10px 12px',
                        borderBottom: '1px solid var(--gris-fondo)',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        background: formData.rut_jugador === j.rut_jugador ? 'var(--gris-fondo)' : 'transparent'
                      }}
                      onMouseEnter={(e) => e.target.style.background = 'var(--gris-fondo)'}
                      onMouseLeave={(e) => e.target.style.background = formData.rut_jugador === j.rut_jugador ? 'var(--gris-fondo)' : 'transparent'}
                    >
                      <div style={{ fontWeight: '600', fontSize: '13px' }}>
                        {j.nombres} {j.apellido_paterno || ''}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--gris-secundario)' }}>
                        {j.rut_jugador}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {formData.rut_jugador && (
              <div style={{
                marginTop: '8px',
                padding: '10px',
                background: 'var(--gris-fondo)',
                borderRadius: '8px',
                fontSize: '12px'
              }}>
                <div style={{ color: 'var(--gris-secundario)', marginBottom: '4px' }}>Deportista seleccionado:</div>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  {jugadores.find(j => j.rut_jugador === formData.rut_jugador)?.nombres} ({formData.rut_jugador})
                </div>
                {apoderadoAsignado && (
                  <div style={{ fontSize: '11px', color: 'var(--azul-electrico)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ClipboardList size={12} /> Apoderado: {apoderadoAsignado.nombres || 'Sin nombre'} ({apoderadoAsignado.correo})
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {/* Buscador Socio (modo "solo cuota de socio") */}
          {modoPago === 'socio' && (
          <div className="form-group">
            <label style={{ fontWeight: '600', fontSize: '13px' }}>Socio *</label>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                <Search size={16} color="var(--gris-secundario)" strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="Busca por nombre o RUT..."
                  value={searchTermSocio}
                  onChange={(e) => setSearchTermSocio(e.target.value)}
                  onFocus={() => setShowSocioResults(true)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    paddingLeft: '32px',
                    borderRadius: '8px',
                    border: '1px solid var(--borde)',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {showSocioResults && sociosFiltrados.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'white',
                  border: '1px solid var(--borde)',
                  borderTopWidth: 0,
                  borderBottomLeftRadius: '8px',
                  borderBottomRightRadius: '8px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 1001,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  {sociosFiltrados.map(c => (
                    <button
                      type="button"
                      key={c.rut}
                      onClick={() => {
                        setRutCuentaSocio(c.rut);
                        setSearchTermSocio('');
                        setShowSocioResults(false);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        fontFamily: 'inherit',
                        padding: '10px 12px',
                        borderBottom: '1px solid var(--gris-fondo)',
                        cursor: 'pointer',
                        background: rutCuentaSocio === c.rut ? 'var(--gris-fondo)' : 'transparent'
                      }}
                    >
                      <div style={{ fontWeight: '600', fontSize: '13px' }}>
                        {c.nombres} {c.apellido_paterno || ''}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--gris-secundario)' }}>
                        {c.rut}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {rutCuentaSocio && (
              <div style={{
                marginTop: '8px',
                padding: '10px',
                background: 'var(--gris-fondo)',
                borderRadius: '8px',
                fontSize: '12px'
              }}>
                <div style={{ color: 'var(--gris-secundario)', marginBottom: '4px' }}>Socio seleccionado:</div>
                <div style={{ fontWeight: '600' }}>
                  {cuentasSocias.find(c => c.rut === rutCuentaSocio)?.nombres} ({rutCuentaSocio})
                </div>
              </div>
            )}
          </div>
          )}

          {/* Año y Meses */}
          {puedeContinuar && (
            <div className="form-group">
              <label style={{ fontWeight: '600', fontSize: '13px' }}>Período a pagar *</label>
              
              {/* Selector de año */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', color: 'var(--gris-secundario)' }}>Año:</label>
                <select
                  value={anioSeleccionado}
                  onChange={(e) => {
                    setAnioSeleccionado(Number(e.target.value));
                    setMesesSeleccionados([]);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid var(--borde)',
                    fontSize: '13px',
                    marginTop: '4px'
                  }}
                >
                  {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(año => (
                    <option key={año} value={año}>{año}</option>
                  ))}
                </select>
              </div>

              {/* Botones de meses — verde y bloqueado si ya está pagado, rojo si
                  está pendiente/moroso o es un mes futuro aún sin pagar (solo
                  esos dos casos se pueden seleccionar para registrar). */}
              <div>
                <label style={{ fontSize: '12px', color: 'var(--gris-secundario)', display: 'block', marginBottom: '6px' }}>Selecciona meses:</label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '6px'
                }}>
                  {MESES_ABREV.map((mesAbrev, idx) => {
                    const pagado = mesesYaPagados.has(idx + 1);
                    const seleccionado = mesesSeleccionados.includes(idx);
                    return (
                    <button
                      key={idx}
                      type="button"
                      disabled={pagado}
                      title={pagado ? 'Ya pagado — no se puede volver a registrar' : undefined}
                      onClick={() => {
                        if (pagado) return;
                        const yaSeleccionado = mesesSeleccionados.includes(idx);
                        const nuevosMeses = yaSeleccionado
                          ? mesesSeleccionados.filter(m => m !== idx)
                          : [...mesesSeleccionados, idx].sort((a, b) => a - b);

                        setMesesSeleccionados(nuevosMeses);

                        setMontosPorMes(prev => {
                          const siguiente = { ...prev };
                          if (yaSeleccionado) {
                            delete siguiente[idx];
                          } else {
                            siguiente[idx] = valorMensualidad;
                          }
                          return siguiente;
                        });

                        if (nuevosMeses.length === 1) {
                          const soloMes = nuevosMeses[0];
                          setFormData(prev => ({
                            ...prev,
                            monto_total_pagado: soloMes === idx && !yaSeleccionado ? valorMensualidad : (montosPorMes[soloMes] ?? valorMensualidad)
                          }));
                        } else if (nuevosMeses.length === 0) {
                          setFormData(prev => ({ ...prev, monto_total_pagado: '' }));
                        }
                      }}
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                        border: pagado
                          ? '2px solid var(--verde-victoria)'
                          : seleccionado
                            ? '2px solid var(--azul-electrico)'
                            : '1px solid rgba(255,59,48,0.35)',
                        background: pagado
                          ? 'rgba(52,199,89,0.12)'
                          : seleccionado
                            ? 'rgba(0, 122, 255, 0.1)'
                            : 'rgba(255,59,48,0.05)',
                        color: pagado
                          ? 'var(--verde-victoria)'
                          : seleccionado
                            ? 'var(--azul-electrico)'
                            : 'var(--rojo-alerta)',
                        fontWeight: (seleccionado || pagado) ? '600' : '500',
                        fontSize: '12px',
                        cursor: pagado ? 'not-allowed' : 'pointer',
                        opacity: pagado ? 0.85 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        transition: 'all 0.2s'
                      }}
                    >
                      {pagado && <Check size={11} />}
                      {mesAbrev}
                    </button>
                    );
                  })}
                </div>
              </div>

              {mesesSeleccionados.length > 0 && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px',
                  background: 'var(--verde-victoria)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <Check size={13} /> {mesesSeleccionados.length} mes{mesesSeleccionados.length > 1 ? 'es' : ''} seleccionado{mesesSeleccionados.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}

          {/* Concepto de pago con valor editable */}
          {puedeContinuar && (
            <div className="form-group">
              <label style={{ fontWeight: '600', fontSize: '13px' }}>Concepto de pago *</label>
              <select
                name="concepto_pago"
                value={formData.concepto_pago}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid var(--borde)',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  marginBottom: '10px'
                }}
              >
                <option value="Mensualidad">Mensualidad</option>
                <option value="Mensualidad Socio">Mensualidad Socio</option>
                <option value="Matrícula">Matrícula</option>
              </select>

              {/* Valor editable */}
              <div>
                <label style={{ fontWeight: '600', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                  Valor unitario ($) *
                </label>
                <input
                  type="number"
                  value={valorMensualidad}
                  onChange={handleValorMensualidadChange}
                  min="0"
                  step="1000"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--borde)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    fontWeight: '600',
                    color: 'var(--verde-victoria)'
                  }}
                />
                {mesesSeleccionados.length > 0 && (
                  <div style={{
                    marginTop: '6px',
                    fontSize: '12px',
                    color: 'var(--gris-secundario)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Pin size={12} /> {mesesSeleccionados.length} mes{mesesSeleccionados.length > 1 ? 'es' : ''} × ${valorMensualidad.toLocaleString()} = <strong style={{ color: 'var(--verde-victoria)' }}>${(valorMensualidad * mesesSeleccionados.length).toLocaleString()}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Monto pagado — un solo campo si es un mes, uno por mes si son varios
              (cada mes seleccionado queda como su propio registro al guardar,
              con su propio monto — ver handleSubmit). */}
          {puedeContinuar && mesesSeleccionados.length === 1 && (
            <div className="form-group">
              <label style={{ fontWeight: '600', fontSize: '13px' }}>Monto pagado ($) *</label>
              <input
                type="number"
                name="monto_total_pagado"
                value={formData.monto_total_pagado}
                onChange={(e) => { handleChange(e); actualizarMontoMes(mesesSeleccionados[0], e.target.value); }}
                placeholder="0"
                required
                min="0"
                step="1000"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid var(--borde)',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  marginBottom: '10px',
                  fontWeight: '600',
                  color: 'var(--verde-victoria)'
                }}
              />
              <div style={{
                fontSize: '11px',
                color: 'var(--gris-secundario)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Lightbulb size={12} /> Sugerencia: ${valorMensualidad.toLocaleString()}
              </div>
            </div>
          )}

          {puedeContinuar && mesesSeleccionados.length > 1 && (
            <div className="form-group">
              <label style={{ fontWeight: '600', fontSize: '13px' }}>Monto pagado por mes ($) *</label>
              <div style={{
                fontSize: '11px',
                color: 'var(--gris-secundario)',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Lightbulb size={12} /> Ajusta el monto de cada mes si no todos se pagan igual (ej. un mes parcial o $0).
              </div>
              <div style={{
                padding: '10px',
                background: 'var(--gris-fondo)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {mesesSeleccionados.map((idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '90px', fontSize: '13px', fontWeight: '600' }}>
                      {MESES[idx]} {anioSeleccionado}
                    </div>
                    <input
                      type="number"
                      value={montosPorMes[idx] ?? ''}
                      onChange={(e) => actualizarMontoMes(idx, e.target.value)}
                      placeholder="0"
                      required
                      min="0"
                      step="1000"
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--borde)',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                        fontWeight: '600',
                        color: 'var(--verde-victoria)'
                      }}
                    />
                  </div>
                ))}
                <div style={{
                  marginTop: '4px',
                  paddingTop: '8px',
                  borderTop: '2px solid var(--borde)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: '600',
                  fontSize: '13px'
                }}>
                  <div>Total ({mesesSeleccionados.length} meses):</div>
                  <div style={{ color: 'var(--verde-victoria)' }}>${montoTotalMeses.toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}

          {/* Monto simple si no hay deportista/socio o meses seleccionados */}
          {(!puedeContinuar || mesesSeleccionados.length === 0) && (
            <div className="form-group">
              <label style={{ fontWeight: '600', fontSize: '13px' }}>Monto pagado ($) *</label>
              <input
                type="number"
                name="monto_total_pagado"
                value={formData.monto_total_pagado}
                onChange={handleChange}
                placeholder="0"
                required
                min="0"
                step="1000"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid var(--borde)',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          {/* Upload comprobante */}
          <div className="form-group">
            <label style={{ fontWeight: '600', fontSize: '13px' }}>Comprobante (imagen o PDF)</label>
            <div style={{
              border: '2px dashed var(--borde)',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: archivo ? 'rgba(0,122,255,0.05)' : 'transparent'
            }}>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleArchivoChange}
                style={{ display: 'none' }}
                id="archivo-input"
              />
              <label htmlFor="archivo-input" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Upload size={20} color="var(--gris-secundario)" strokeWidth={1.5} />
                <span style={{ fontSize: '12px', fontWeight: '600' }}>
                  {archivo ? archivo.name : 'Haz clic para seleccionar'}
                </span>
              </label>
            </div>
            {formData.comprobante_url && !archivo && (
              <p style={{ fontSize: '11px', color: 'var(--verde-victoria)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Check size={12} /> Comprobante ya cargado
              </p>
            )}
          </div>

          {/* Notas */}
          <div className="form-group">
            <label style={{ fontWeight: '600', fontSize: '13px' }}>Notas</label>
            <textarea
              name="notas_tesoreria"
              value={formData.notas_tesoreria}
              onChange={handleChange}
              placeholder="Notas adicionales..."
              rows="3"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--borde)',
                fontSize: '13px',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                background: 'var(--gris-fondo)',
                border: '1px solid var(--borde)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando}
              style={{
                flex: 1,
                padding: '12px',
                background: cargando ? 'var(--gris-deshabilitado)' : 'var(--azul-electrico)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: cargando ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                opacity: cargando ? 0.6 : 1
              }}
            >
              {cargando ? 'Guardando...' : (!pago?.id && autoAprobar) ? 'Registrar y Confirmar' : 'Guardar Pago'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

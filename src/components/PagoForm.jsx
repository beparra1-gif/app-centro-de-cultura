import React, { useState, useEffect } from 'react';
import { X, Upload, Search } from 'lucide-react';
import * as api from '../api/client.js';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_ABREV = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Valores de referencia para concepto de pago
const VALORES_CONCEPTO = {
  'Mensualidad': 25000,
  'Mensualidad Socio': 15000,
  'Matrícula': 50000
};

export default function PagoForm({ pago = null, jugadores = [], cuentas = [], onClose, onSave }) {
  const [formData, setFormData] = useState({
    rut_jugador: pago?.rut_jugador || '',
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
  const [apoderadoAsignado, setApoderadoAsignado] = useState(null);
  
  // Datos del jugador seleccionado
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState(null);
  const [valorMensualidad, setValorMensualidad] = useState(0);
  const [desglose, setDesglose] = useState(null);

  // Filtrar deportistas según búsqueda
  const deportistasFiltrados = searchTerm.trim() ? jugadores.filter(j => {
    const rut = (j.rut_jugador || '').toLowerCase();
    const nombres = (j.nombres || '').toLowerCase();
    const apellidos = `${j.apellido_paterno || ''} ${j.apellido_materno || ''}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    return rut.includes(search) || nombres.includes(search) || apellidos.includes(search);
  }) : [];

  // Calcular desglose de abono automáticamente
  const calcularDesglose = (monto, concepto, meses) => {
    if (monto <= 0 || meses.length === 0) return null;

    const valorConcepto = VALORES_CONCEPTO[concepto] || 25000;
    let montoRestante = monto;
    const detalles = [];
    let mesesCubiertos = 0;

    for (let i = 0; i < meses.length && montoRestante > 0; i++) {
      const mesIdx = meses[i];
      const montoDelMes = Math.min(montoRestante, valorConcepto);
      
      detalles.push({
        mes: `${MESES[mesIdx]} ${anioSeleccionado}`,
        monto: montoDelMes,
        cubierto: montoDelMes >= valorConcepto ? 'Completo' : `Parcial (${(montoDelMes / valorConcepto * 100).toFixed(0)}%)`
      });

      if (montoDelMes >= valorConcepto) {
        mesesCubiertos++;
      }

      montoRestante -= montoDelMes;
    }

    return {
      detalles,
      montoRestante,
      mesesCubiertos,
      totalAplicado: monto - montoRestante
    };
  };

  // Actualizar cuando se selecciona un deportista
  useEffect(() => {
    if (formData.rut_jugador) {
      const jugador = jugadores.find(j => j.rut_jugador === formData.rut_jugador);
      if (jugador) {
        setJugadorSeleccionado(jugador);
        
        // Traer valor de mensualidad
        const mensualidad = jugador.valor_mensualidad || 25000;
        setValorMensualidad(mensualidad);
        
        // Traer correo apoderado
        setFormData(prev => ({
          ...prev,
          correo_apoderado: jugador.correo_apoderado || ''
        }));

        // Buscar apoderado asignado
        const apoderado = cuentas.find(c => c.correo_usuario === jugador.correo_apoderado);
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
        setDesglose(null);
      }
    }
  }, [formData.rut_jugador, jugadores, cuentas]);

  // Actualizar desglose cuando cambia monto o meses
  useEffect(() => {
    if (formData.monto_total_pagado > 0 && mesesSeleccionados.length > 0) {
      const desgloseCal = calcularDesglose(
        Number(formData.monto_total_pagado),
        formData.concepto_pago,
        mesesSeleccionados
      );
      setDesglose(desgloseCal);
      
      // Actualizar cantidad_meses_pagados basado en el desglose
      setFormData(prev => ({
        ...prev,
        cantidad_meses_pagados: desgloseCal?.mesesCubiertos || mesesSeleccionados.length
      }));
    }
  }, [formData.monto_total_pagado, formData.concepto_pago, mesesSeleccionados, anioSeleccionado]);

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

    // Recalcular monto automáticamente
    if (mesesSeleccionados.length > 0) {
      const nuevoMonto = nuevoValor * mesesSeleccionados.length;
      setFormData(prev => ({
        ...prev,
        monto_total_pagado: nuevoMonto
      }));
    }
    setError('');
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
      if (!formData.rut_jugador) throw new Error('Selecciona un deportista');
      if (mesesSeleccionados.length === 0) throw new Error('Selecciona al menos un mes para pagar');
      if (!formData.monto_total_pagado || formData.monto_total_pagado <= 0) throw new Error('Monto debe ser mayor a 0');

      const datosGuardar = { ...formData };

      // Si hay archivo, convertir a base64
      if (archivo) {
        const reader = new FileReader();
        await new Promise((resolve, reject) => {
          reader.onload = () => {
            datosGuardar.comprobante_url = reader.result;
            resolve();
          };
          reader.onerror = reject;
          reader.readAsDataURL(archivo);
        });
      }

      if (pago?.id) {
        // Actualizar
        await api.pagosMensualidadesAPI.update(pago.id, datosGuardar);
        setSuccess('Pago actualizado exitosamente');
      } else {
        // Crear
        await api.pagosMensualidadesAPI.create(datosGuardar);
        setSuccess('Pago creado exitosamente');
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

  return (
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
            {pago?.id ? 'Editar Pago' : 'Nuevo Pago'}
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
            <X size={24} color="#6B7280" strokeWidth={1.5} />
          </button>
        </div>

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
          {/* Buscador Deportista */}
          <div className="form-group">
            <label style={{ fontWeight: '600', fontSize: '13px' }}>Deportista *</label>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                <Search size={16} color="#6B7280" strokeWidth={1.5} />
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
                    <div
                      key={j.rut_jugador}
                      onClick={() => {
                        setFormData(prev => ({ ...prev, rut_jugador: j.rut_jugador }));
                        setSearchTerm('');
                        setShowSearchResults(false);
                      }}
                      style={{
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
                    </div>
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
                  <div style={{ fontSize: '11px', color: 'var(--azul-electrico)', fontWeight: '600' }}>
                    📋 Apoderado: {apoderadoAsignado.nombres || 'Sin nombre'} ({apoderadoAsignado.correo_usuario})
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Año y Meses */}
          {formData.rut_jugador && (
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

              {/* Botones de meses */}
              <div>
                <label style={{ fontSize: '12px', color: 'var(--gris-secundario)', display: 'block', marginBottom: '6px' }}>Selecciona meses:</label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '6px'
                }}>
                  {MESES_ABREV.map((mesAbrev, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const nuevosMeses = mesesSeleccionados.includes(idx)
                          ? mesesSeleccionados.filter(m => m !== idx)
                          : [...mesesSeleccionados, idx].sort((a, b) => a - b);
                        
                        setMesesSeleccionados(nuevosMeses);

                        // Auto-calcular monto basado en cantidad de meses
                        if (nuevosMeses.length > 0) {
                          const nuevoMonto = valorMensualidad * nuevosMeses.length;
                          setFormData(prev => ({
                            ...prev,
                            monto_total_pagado: nuevoMonto
                          }));
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            monto_total_pagado: ''
                          }));
                        }
                      }}
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                        border: mesesSeleccionados.includes(idx)
                          ? '2px solid var(--azul-electrico)'
                          : '1px solid var(--borde)',
                        background: mesesSeleccionados.includes(idx)
                          ? 'rgba(0, 122, 255, 0.1)'
                          : 'white',
                        color: mesesSeleccionados.includes(idx)
                          ? 'var(--azul-electrico)'
                          : 'var(--texto-primario)',
                        fontWeight: mesesSeleccionados.includes(idx) ? '600' : '500',
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {mesAbrev}
                    </button>
                  ))}
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
                  color: 'white'
                }}>
                  ✓ {mesesSeleccionados.length} mes{mesesSeleccionados.length > 1 ? 'es' : ''} seleccionado{mesesSeleccionados.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}

          {/* Concepto de pago con valor editable */}
          {formData.rut_jugador && (
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
                    color: 'var(--gris-secundario)'
                  }}>
                    📌 {mesesSeleccionados.length} mes{mesesSeleccionados.length > 1 ? 'es' : ''} × ${valorMensualidad.toLocaleString()} = <strong style={{ color: 'var(--verde-victoria)' }}>${(valorMensualidad * mesesSeleccionados.length).toLocaleString()}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Monto pagado y desglose */}
          {formData.rut_jugador && mesesSeleccionados.length > 0 && (
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
                  boxSizing: 'border-box',
                  marginBottom: '10px',
                  fontWeight: '600',
                  color: 'var(--verde-victoria)'
                }}
              />
              <div style={{
                fontSize: '11px',
                color: 'var(--gris-secundario)',
                marginBottom: '10px'
              }}>
                💡 Sugerencia: ${(valorMensualidad * mesesSeleccionados.length).toLocaleString()} ({mesesSeleccionados.length} meses × ${valorMensualidad.toLocaleString()})
              </div>

              {/* Desglose automático */}
              {desglose && (
                <div style={{
                  padding: '12px',
                  background: 'var(--gris-fondo)',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--texto-heading)' }}>
                    📊 Desglose del abono:
                  </div>
                  {desglose.detalles.map((detalle, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 0',
                        borderBottom: idx < desglose.detalles.length - 1 ? '1px solid var(--borde)' : 'none'
                      }}
                    >
                      <div>
                        <strong>{detalle.mes}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--gris-secundario)' }}>
                          {detalle.cubierto}
                        </div>
                      </div>
                      <div style={{ fontWeight: '600', color: 'var(--verde-victoria)' }}>
                        ${detalle.monto.toLocaleString()}
                      </div>
                    </div>
                  ))}
                  <div style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '2px solid var(--borde)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: '600'
                  }}>
                    <div>Total a aplicar:</div>
                    <div style={{ color: 'var(--verde-victoria)' }}>
                      ${desglose.totalAplicado.toLocaleString()}
                    </div>
                  </div>
                  {desglose.montoRestante > 0 && (
                    <div style={{
                      marginTop: '6px',
                      padding: '6px',
                      background: 'rgba(255, 193, 7, 0.1)',
                      borderRadius: '4px',
                      color: 'var(--texto-primario)',
                      fontSize: '11px'
                    }}>
                      ℹ️ Excedente de ${desglose.montoRestante.toLocaleString()} (se aplica a próximos meses)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Monto simple si no hay deportista o meses seleccionados */}
          {(!formData.rut_jugador || mesesSeleccionados.length === 0) && (
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
                <Upload size={20} color="#6B7280" strokeWidth={1.5} />
                <span style={{ fontSize: '12px', fontWeight: '600' }}>
                  {archivo ? archivo.name : 'Haz clic para seleccionar'}
                </span>
              </label>
            </div>
            {formData.comprobante_url && !archivo && (
              <p style={{ fontSize: '11px', color: 'var(--verde-victoria)', marginTop: '6px' }}>
                ✓ Comprobante ya cargado
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
              {cargando ? 'Guardando...' : 'Guardar Pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

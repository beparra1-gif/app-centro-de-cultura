import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Camera, Clock, LayoutGrid, List, Search, User, X } from 'lucide-react';
import { getUTMLastDayPreviousMonth } from '../utils/appHelpers';
import { calcularCuotaFinal, noDebeMensualidad } from '../utils/beca';
import { showToast } from '../utils/toast';
import * as api from '../api/client';
import LogoAvatar from './LogoAvatar';

function PerfilTesoreriaPanel({
  pupiloActivo,
  setPupiloActivo,
  rolUsuario,
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
  const [busquedaCuenta, setBusquedaCuenta] = useState('');
  // mesesSeleccionados (prop, { [rutPupilo]: number[] }) representa la
  // grilla de Mensualidad Deportista, con selección independiente por
  // pupilo; la de Cuota Socio es independiente para que el socio/apoderado
  // pueda pagar solo una, solo la otra, o ambas.
  const [mesesSocioSeleccionados, setMesesSocioSeleccionados] = useState([]);

  const esVistaAdmin = rolUsuario === 'admin' || rolUsuario === 'super_admin';

  // Revisión mensual de becas: el admin/superadmin confirma mes a mes que
  // cada beca sigue vigente (ver backend/server.js, tabla beca_revisiones).
  const mesRevisionActual = new Date().toISOString().slice(0, 7);
  const [becasPorRevisar, setBecasPorRevisar] = useState([]);
  const [cargandoBecas, setCargandoBecas] = useState(false);
  const [guardandoBecaRut, setGuardandoBecaRut] = useState(null);
  const [porcentajeDraftPorRut, setPorcentajeDraftPorRut] = useState({});

  useEffect(() => {
    if (!esVistaAdmin) return;
    let cancelado = false;
    setCargandoBecas(true);
    api.becaAPI.getRevisiones(mesRevisionActual)
      .then((datos) => { if (!cancelado) setBecasPorRevisar(Array.isArray(datos) ? datos : []); })
      .catch((error) => { if (!cancelado) showToast({ message: error.message || 'No se pudieron cargar las becas a revisar.', type: 'error' }); })
      .finally(() => { if (!cancelado) setCargandoBecas(false); });
    return () => { cancelado = true; };
  }, [esVistaAdmin, mesRevisionActual]);

  const becasPendientesDeRevision = becasPorRevisar.filter((j) => !j.revision_mes_actual);

  const confirmarBecaVigente = async (jugadorBeca) => {
    const rut = jugadorBeca.rut_jugador;
    const porcentaje = Number(porcentajeDraftPorRut[rut] ?? jugadorBeca.beca);
    if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
      showToast({ message: 'El porcentaje de beca debe estar entre 0 y 100.', type: 'error' });
      return;
    }
    try {
      setGuardandoBecaRut(rut);
      const revision = await api.becaAPI.confirmar({ rut_jugador: rut, mes: mesRevisionActual, porcentaje });
      setBecasPorRevisar((prev) => prev.map((j) => (
        j.rut_jugador === rut ? { ...j, beca: porcentaje, revision_mes_actual: revision } : j
      )));
      showToast({ message: `Beca de ${jugadorBeca.nombres || 'el jugador'} confirmada para este mes.`, type: 'success' });
    } catch (error) {
      showToast({ message: error.message || 'No se pudo confirmar la beca.', type: 'error' });
    } finally {
      setGuardandoBecaRut(null);
    }
  };

  const normalizarTextoBusqueda = (texto = '') => String(texto || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const resultadosBusqueda = useMemo(() => {
    const termino = normalizarTextoBusqueda(busquedaCuenta);
    if (!esVistaAdmin || termino.length < 2) return [];

    const cuentasPorCorreo = new Map(
      (Array.isArray(cuentasAdmin) ? cuentasAdmin : []).map((c) => [String(c.correo || '').trim().toLowerCase(), c])
    );

    return (Array.isArray(pupilosDisponibles) ? pupilosDisponibles : [])
      .filter((j) => {
        const cuenta = cuentasPorCorreo.get(String(j.correo_apoderado || '').trim().toLowerCase());
        const camposTexto = [
          j.nombre,
          j.rut,
          cuenta?.nombres,
          cuenta?.apellido_paterno,
          cuenta?.correo,
          cuenta?.rut,
        ].map(normalizarTextoBusqueda).join(' ');
        return camposTexto.includes(termino);
      })
      .slice(0, 20)
      .map((j) => ({
        jugador: j,
        cuenta: cuentasPorCorreo.get(String(j.correo_apoderado || '').trim().toLowerCase()) || null,
      }));
  }, [busquedaCuenta, esVistaAdmin, cuentasAdmin, pupilosDisponibles]);

  const seleccionarResultadoBusqueda = (jugador) => {
    if (typeof setPupiloActivo === 'function') setPupiloActivo(jugador);
    setBusquedaCuenta('');
  };

  const mesesBase = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const anioObjetivo = 2026;
  const normalizarRutCuenta = (rut = '') => String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
  const cuentaActual = Array.isArray(cuentasAdmin)
    ? cuentasAdmin.find((cuenta) => {
      const rutCuenta = normalizarRutCuenta(cuenta.rut || '');
      const rutApoderado = normalizarRutCuenta(pupiloActivo?.rut_apoderado || '');
      if (rutCuenta && rutApoderado && rutCuenta === rutApoderado) return true;

      const correoCuenta = String(cuenta.correo || '').trim().toLowerCase();
      const correoApoderado = String(pupiloActivo?.correo_apoderado || '').trim().toLowerCase();
      return Boolean(correoCuenta && correoApoderado && correoCuenta === correoApoderado);
    }) || null
    : null;
  const pupilosActivos = esVistaAdmin
    ? (pupiloActivo ? [pupiloActivo] : [])
    : (Array.isArray(pupilosDisponibles) && pupilosDisponibles.length > 0
      ? pupilosDisponibles
      : (pupiloActivo ? [pupiloActivo] : []));
  const rutPupiloActivo = pupiloActivo?.rut || pupilosActivos[0]?.rut;
  const normalizarRutComparacion = (rut = '') => String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
  const rutPupiloActivoNormalizado = normalizarRutComparacion(rutPupiloActivo);
  const rutCuentaNormalizado = normalizarRutComparacion(cuentaActual?.rut || '');
  const esPagoInvalidoLegacy = (pago = {}) => {
    const monto = Number(pago.monto_total_pagado || 0);
    const meses = String(pago.meses_correspondientes || '').trim();
    const notas = String(pago.notas_tesoreria || '').toLowerCase();
    const sinMes = /^sinmes\b/i.test(meses);
    const correccionLegacy = notas.includes('correccion requerida');
    return (monto <= 0 && sinMes) || (monto <= 0 && correccionLegacy);
  };
  const titular = cuentaActual
    ? `${cuentaActual.nombres || ''} ${cuentaActual.apellido_paterno || ''}`.trim()
    : (pupiloActivo?.nombre || pupilosActivos[0]?.nombre || 'Cuenta principal');
  const perfilPrincipal = String(cuentaActual?.perfil_principal || cuentaActual?.rol || '').toLowerCase();
  const esSocio = Boolean(cuentaActual?.es_socio) || ['socio', 'socio_apoderado', 'directiva'].includes(perfilPrincipal);
  const esSocioApoderado = perfilPrincipal === 'socio_apoderado';

  const morosoActivo = (morososAdmin || []).find((m) => {
    const rutMoroso = normalizarRutComparacion(m?.rut || '');
    return rutMoroso && rutMoroso === rutPupiloActivoNormalizado;
  }) || null;
  const mesesAtraso = Number(morosoActivo?.mesesDeuda || 0);
  const estadoCuenta = mesesAtraso > 0 ? 'Moroso' : 'Al Día';

  const getMesNumero = (texto = '') => {
    const token = String(texto || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .slice(0, 3);
    const idx = mesesBase.findIndex((m) => m.toLowerCase() === token);
    return idx >= 0 ? idx + 1 : null;
  };

  const getAnioIngreso = (pupilo = {}) => {
    const candidatos = [
      pupilo?.anio_ingreso,
      pupilo?.año_ingreso,
    ];
    for (const valor of candidatos) {
      const num = Number(valor);
      if (Number.isFinite(num) && num >= 2000 && num <= 2100) return num;
    }

    const fechaIngreso = String(pupilo?.fecha_ingreso || '').trim();
    const matchFecha = fechaIngreso.match(/(20\d{2})/);
    if (matchFecha) return Number(matchFecha[1]);

    // Regla de negocio: sin mes/año configurados => enero 2026.
    return anioObjetivo;
  };

  // Si el admin fijó mes_inicio_cobro a mano, es su criterio final y se
  // respeta tal cual. Si no, se deriva de fecha_ingreso cobrando desde el mes
  // SIGUIENTE al de ingreso (regla de negocio: sin prorrateo del mes de
  // ingreso — ej. ingresó en marzo, el cobro parte en abril). Debe coincidir
  // exactamente con obtenerPrimerMesCobrableJugador en backend/server.js.
  const obtenerInicioCobro = (pupilo = {}) => {
    const anioIngreso = getAnioIngreso(pupilo);
    const mesDesdeCampo = getMesNumero(pupilo.mes_inicio_cobro || '');

    if (mesDesdeCampo) {
      if (anioIngreso > anioObjetivo) return 13;
      if (anioIngreso < anioObjetivo) return 1;
      return mesDesdeCampo;
    }

    const fechaIngreso = String(pupilo?.fecha_ingreso || '').trim();
    const fecha = fechaIngreso ? new Date(fechaIngreso) : null;
    if (fecha instanceof Date && !Number.isNaN(fecha.getTime())) {
      const anioFecha = fecha.getFullYear();
      const mesFecha = fecha.getMonth() + 1;
      const anioSiguiente = mesFecha >= 12 ? anioFecha + 1 : anioFecha;
      const mesSiguiente = mesFecha >= 12 ? 1 : mesFecha + 1;
      if (anioSiguiente > anioObjetivo) return 13;
      if (anioSiguiente < anioObjetivo) return 1;
      return mesSiguiente;
    }

    if (anioIngreso > anioObjetivo) return 13;
    if (anioIngreso < anioObjetivo) return 1;
    return 1;
  };

  const monthFromPago = (pago) => {
    if (Number.isFinite(Number(pago.mes_pago_numero))) return Number(pago.mes_pago_numero);

    if (typeof pago.meses_correspondientes === 'string' && pago.meses_correspondientes.trim()) {
      const texto = String(pago.meses_correspondientes || '').trim();
      const yearMatch = texto.match(/(20\d{2})/);
      const year = yearMatch ? Number(yearMatch[1]) : anioObjetivo;
      if (year !== anioObjetivo) return null;

      const tokenBase = texto.split(/\s+/)[0];
      const mesDesdeToken = getMesNumero(tokenBase.split('-')[0]);
      if (mesDesdeToken) return mesDesdeToken;
    }

    if (typeof pago.mes_pagado === 'string' && pago.mes_pagado.length >= 3) {
      const normalized = pago.mes_pagado.slice(0, 3).toLowerCase();
      const idx = mesesBase.findIndex((m) => m.toLowerCase() === normalized);
      return idx >= 0 ? idx + 1 : null;
    }
    return null;
  };

  const pagosJugador = (pagosMensualidadesAdmin || []).filter((p) => {
    if (esPagoInvalidoLegacy(p)) return false;
    if (!rutPupiloActivo) return false;
    const rutJugadorPago = normalizarRutComparacion(p.rut_jugador);
    const rutPagadorPago = normalizarRutComparacion(p.rut_pagos);
    if (rutJugadorPago && rutJugadorPago === rutPupiloActivoNormalizado) return true;
    if (rutPagadorPago && rutPagadorPago === rutPupiloActivoNormalizado) return true;

    // Fallback para cuentas con un solo pupilo: acepta pagos ligados por rut_pagos.
    if (!rutJugadorPago && pupilosActivos.length <= 1 && rutCuentaNormalizado && rutPagadorPago === rutCuentaNormalizado) {
      return true;
    }

    return false;
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
  const limiteMesDeuda = Math.max(0, mesActual - 1);
  const inicioCobroActivo = obtenerInicioCobro(pupiloActivo || pupilosActivos[0] || {});
  const mesesVisuales = mesesBase.map((mes, idx) => {
    const mesNumero = idx + 1;
    const estadosMes = pagosPorMes[mesNumero] || [];
    // Solo la beca del 100% o la exención explícita auto-marcan el mes como
    // pagado (no hay nada que cobrar); una beca parcial sigue el flujo normal
    // de pago a la cuota ya descontada (ver obtenerCuotaMensualPupilo).
    const sinCargoMensual = noDebeMensualidad(pupiloActivo || pupilosActivos[0] || {});
    const estado = (estadosMes.includes('aprobado') || estadosMes.includes('validado'))
      ? 'pagado'
      : (sinCargoMensual && mesNumero <= limiteMesDeuda)
        ? 'pagado'
      : (mesNumero < inicioCobroActivo)
        ? 'futuro-preingreso'
        : (mesNumero > limiteMesDeuda)
          ? 'futuro-calendario'
      : (estadosMes.includes('pendiente') || estadosMes.includes('rechazado'))
        ? 'pendiente'
        : (mesNumero <= limiteMesDeuda ? 'pendiente' : 'futuro-calendario');

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

    // Los becados al 100% y los exentos no aportan nada a la suma; los con
    // beca parcial sí aportan, pero ya descontada (calcularCuotaFinal).
    const pupilosConCuota = pupilosActivos.filter((p) => !noDebeMensualidad(p));
    if (pupilosConCuota.length === 0) return 0;

    const sumaDesdeSheet = pupilosConCuota.reduce((acc, p) => {
      const monto = Number(p?.valor_mensualidad || 0);
      const base = Number.isFinite(monto) && monto > 0 ? monto : 0;
      return acc + calcularCuotaFinal(base, p);
    }, 0);
    if (sumaDesdeSheet > 0) return Math.round(sumaDesdeSheet);

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

  // Cuota mensual real de UN pupilo: si la ficha trae valor_mensualidad
  // propio (caso normal, viene de la hoja) se usa tal cual; si no, se reparte
  // en partes iguales la tarifa agregada (mismo criterio que "Cuota vigente").
  const obtenerCuotaMensualPupilo = (pupilo = {}) => {
    const monto = Number(pupilo?.valor_mensualidad || 0);
    const base = Number.isFinite(monto) && monto > 0 ? monto : cuotaDeportistaReferencial;
    return calcularCuotaFinal(base, pupilo);
  };

  const tarifaRedondeada = Math.round(tarifaMensual);
  const totalSocioSeleccionado = cuotaSocioAplicada * mesesSocioSeleccionados.length;
  const totalMesesJugadorSeleccionados = pupilosActivos.reduce((acc, p) => acc + (mesesSeleccionados[p.rut] || []).length, 0);
  const totalJugadorSeleccionado = pupilosActivos.reduce((acc, p) => (
    acc + obtenerCuotaMensualPupilo(p) * (mesesSeleccionados[p.rut] || []).length
  ), 0);
  const totalSeleccionado = totalSocioSeleccionado + totalJugadorSeleccionado;
  const totalMesesSeleccionados = mesesSocioSeleccionados.length + totalMesesJugadorSeleccionados;
  const totalFinalPagar = tipoPago === 'completo' ? totalSeleccionado : (Number(montoAbono) || 0);

  // Reutilizable para ambas grillas (socio/deportista): solo 'pendiente' y
  // 'futuro-calendario' son seleccionables. 'pagado' y 'futuro-preingreso'
  // quedan bloqueados (mes ya pagado o anterior a la fecha de ingreso).
  const toggleMesEnLista = (idMes, estado, lista, setLista) => {
    if (estado === 'pagado') return;
    if (estado === 'futuro-preingreso') {
      showToast({ message: 'Ese mes es anterior a la fecha de ingreso: no corresponde cobrarlo.', type: 'error' });
      return;
    }
    if (!['pendiente', 'futuro-calendario'].includes(estado)) return;
    if (lista.includes(idMes)) {
      setLista(lista.filter((m) => m !== idMes));
    } else {
      setLista([...lista, idMes]);
    }
  };

  const toggleMesSocio = (idMes, estado) => toggleMesEnLista(idMes, estado, mesesSocioSeleccionados, setMesesSocioSeleccionados);

  // Cada pupilo tiene su propio arreglo de meses dentro de mesesSeleccionados
  // (clave = rut del pupilo) — así marcar un mes en la tarjeta de un hermano
  // ya no afecta la selección de los demás.
  const toggleMesPupilo = (rutPupilo, idMes, estado) => {
    if (estado === 'pagado') return;
    if (estado === 'futuro-preingreso') {
      showToast({ message: 'Ese mes es anterior a la fecha de ingreso: no corresponde cobrarlo.', type: 'error' });
      return;
    }
    if (!['pendiente', 'futuro-calendario'].includes(estado)) return;
    setMesesSeleccionados((prev) => {
      const actuales = prev[rutPupilo] || [];
      const nuevos = actuales.includes(idMes) ? actuales.filter((m) => m !== idMes) : [...actuales, idMes];
      return { ...prev, [rutPupilo]: nuevos };
    });
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
    if (totalMesesSeleccionados === 0) {
      setErrorComprobante('Selecciona al menos un mes (cuota socio, deportista, o ambas) para registrar el pago.');
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

      const payloadBase = {
        rut_pagos: cuentaActual?.rut || '',
        correo_apoderado: cuentaActual?.correo || pupiloActivo?.correo_apoderado || '',
        cantidad_meses_pagados: 1,
        comprobante_url: comprobanteUrl,
      };

      // Reparto parejo del abono entre TODOS los meses seleccionados de ambas
      // grillas y de todos los pupilos (misma regla de reparto que ya existía
      // para un solo set de meses).
      const montoUnitarioAbono = tipoPago === 'abono' && totalMesesSeleccionados > 0
        ? Number((monto / totalMesesSeleccionados).toFixed(0))
        : null;

      const pagosCreados = [];
      const crearPagosPara = async (meses, concepto, montoPorDefecto, rutJugadorPago) => {
        const mesesOrdenados = [...meses].sort((a, b) => a - b);
        for (const mesNumero of mesesOrdenados) {
          const mesTexto = String(mesesBase[mesNumero - 1] || '').toLowerCase();
          const pagoCreado = await api.pagosMensualidadesAPI.create({
            ...payloadBase,
            rut_jugador: rutJugadorPago,
            concepto_pago: concepto,
            meses_correspondientes: `${mesTexto}-${anioObjetivo}`,
            monto_total_pagado: montoUnitarioAbono !== null && montoUnitarioAbono > 0 ? montoUnitarioAbono : montoPorDefecto,
          });
          pagosCreados.push(pagoCreado);
        }
      };

      await crearPagosPara(mesesSocioSeleccionados, 'Mensualidad Socio', cuotaSocioAplicada, rutPupiloActivo);

      // Cada pupilo genera sus propias filas de pago, con su propia cuota y
      // sus propios meses seleccionados (antes se usaba un único set de meses
      // compartido entre todos los hermanos).
      for (const pupilo of pupilosActivos) {
        const mesesPupilo = mesesSeleccionados[pupilo.rut] || [];
        if (mesesPupilo.length === 0) continue;
        await crearPagosPara(mesesPupilo, 'Mensualidad', obtenerCuotaMensualPupilo(pupilo), pupilo.rut);
      }

      setComprobanteSubido(true);
      setPagosPendientesAdmin((prev) => [
        ...(Array.isArray(prev) ? prev : []),
        ...pagosCreados.filter(Boolean),
      ]);
    } catch (error) {
      setErrorComprobante(error.message || 'No se pudo enviar el comprobante.');
    } finally {
      setSubiendoComprobante(false);
    }
  };

  return (
    <div className="fade-in">
      {esVistaAdmin && (
        <div className="card" style={{ borderRadius: '22px', padding: '14px', position: 'relative' }}>
          <label style={{ fontSize: '12px', fontWeight: '900', color: 'var(--texto-heading)', display: 'block', marginBottom: '8px' }}>
            Buscar jugador, socio o apoderado
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-secundario)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px', paddingRight: busquedaCuenta ? '36px' : undefined }}
              placeholder="Nombre, RUT o correo del jugador, socio o apoderado..."
              value={busquedaCuenta}
              onChange={(e) => setBusquedaCuenta(e.target.value)}
            />
            {busquedaCuenta && (
              <button
                type="button"
                onClick={() => setBusquedaCuenta('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-secundario)', padding: '4px' }}
                aria-label="Limpiar búsqueda"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {resultadosBusqueda.length > 0 && (
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
              {resultadosBusqueda.map((r) => (
                <button
                  type="button"
                  key={r.jugador.rut || r.jugador.id}
                  onClick={() => seleccionarResultadoBusqueda(r.jugador)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '14px', border: '1px solid var(--borde-suave)', background: 'rgba(0,122,255,0.04)', cursor: 'pointer', textAlign: 'left' }}
                >
                  <User size={18} color="var(--azul-electrico)" />
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: '13px', color: 'var(--texto-principal)' }}>{r.jugador.nombre || 'Jugador'}</strong>
                    <span style={{ display: 'block', fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                      {r.jugador.rut || 'Sin RUT'}{r.cuenta ? ` · Apoderado: ${r.cuenta.nombres || ''} ${r.cuenta.apellido_paterno || ''}`.trim() : ''}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {busquedaCuenta.length >= 2 && resultadosBusqueda.length === 0 && (
            <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '700' }}>Sin resultados para "{busquedaCuenta}".</p>
          )}

          {pupiloActivo && (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--borde-suave)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                Revisando cuenta de: <strong style={{ color: 'var(--texto-principal)' }}>{pupiloActivo.nombre}</strong>
              </span>
              <button type="button" className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => setPupiloActivo(null)}>
                Cambiar búsqueda
              </button>
            </div>
          )}
        </div>
      )}

      {esVistaAdmin && (
        <div className="card mt-15" style={{ borderRadius: '22px', padding: '14px' }}>
          <h4 className="form-subtitle" style={{ marginBottom: '6px' }}>Becas por revisar este mes ({mesRevisionActual})</h4>
          <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--texto-secundario)' }}>
            Confirma mes a mes que cada beca sigue vigente. Si cambió, ajusta el porcentaje antes de confirmar.
          </p>

          {cargandoBecas && <p style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>Cargando...</p>}

          {!cargandoBecas && becasPorRevisar.length === 0 && (
            <p style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontStyle: 'italic' }}>No hay jugadores con beca activa.</p>
          )}

          {!cargandoBecas && becasPorRevisar.length > 0 && becasPendientesDeRevision.length === 0 && (
            <p style={{ fontSize: '12px', color: 'var(--verde-victoria)', fontWeight: '700' }}>Todas las becas ({becasPorRevisar.length}) ya fueron revisadas este mes.</p>
          )}

          {becasPendientesDeRevision.map((j) => (
            <div key={j.rut_jugador} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '14px', border: '1px solid rgba(255,149,0,0.35)', background: 'rgba(255,149,0,0.06)', marginBottom: '8px' }}>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <strong style={{ fontSize: '13px' }}>{`${j.nombres || ''} ${j.apellido_paterno || ''}`.trim()}</strong>
                <div style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>{j.rut_jugador} · {j.rama || 'N/A'} · {j.categoria || 'N/A'}</div>
              </div>
              <input
                type="number"
                min="0"
                max="100"
                className="form-input"
                style={{ margin: 0, width: '80px' }}
                value={porcentajeDraftPorRut[j.rut_jugador] ?? j.beca ?? 0}
                onChange={(e) => setPorcentajeDraftPorRut((prev) => ({ ...prev, [j.rut_jugador]: e.target.value }))}
              />
              <span style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>%</span>
              <button
                type="button"
                className="btn-secondary"
                style={{ width: 'auto', padding: '8px 12px' }}
                disabled={guardandoBecaRut === j.rut_jugador}
                onClick={() => confirmarBecaVigente(j)}
              >
                {guardandoBecaRut === j.rut_jugador ? 'Guardando...' : 'Confirmar vigente'}
              </button>
            </div>
          ))}
        </div>
      )}

      {(!esVistaAdmin || pupiloActivo) ? (
        <>
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
          <div className="status-alert"><AlertTriangle size={16} color="var(--gris-secundario)" strokeWidth={1.5} /> Presenta {mesesAtraso} meses de atraso en cuotas.</div>
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
                      <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: 'var(--azul-marino)', fontWeight: '800' }}>Cuota vigente: ${obtenerCuotaMensualPupilo(pupilo).toLocaleString('es-CL')} / mes</span>
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
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--rojo-alerta)', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={18} color="var(--gris-secundario)" strokeWidth={1.5} /> Deuda Pendiente</h4>
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
                <button type="button" key={item.id} onClick={() => toggleMesSocio(item.id, item.estado)} className={`mes-box mes-${item.estado} ${mesesSocioSeleccionados.includes(item.id) ? 'seleccionado' : ''}`}>
                  <span className="mes-box-nombre">{item.mes}</span>
                </button>
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
                const inicioCobroPupilo = obtenerInicioCobro(pupilo);
                const becaActivaPupilo = noDebeMensualidad(pupilo);
                const rutPupiloCardNormalizado = normalizarRutComparacion(pupilo.rut);
                const pagosDelPupilo = (pagosMensualidadesAdmin || []).filter(
                  (p) => {
                    if (esPagoInvalidoLegacy(p)) return false;
                    const rutJugadorPago = normalizarRutComparacion(p.rut_jugador);
                    const rutPagadorPago = normalizarRutComparacion(p.rut_pagos);
                    return rutJugadorPago === rutPupiloCardNormalizado || rutPagadorPago === rutPupiloCardNormalizado;
                  }
                );
                const estadosMes = pagosDelPupilo
                  .filter((pago) => monthFromPago(pago) === mesNumero)
                  .map((pago) => (pago.estado_pago || '').toLowerCase());
                const estadoMes = (estadosMes.includes('aprobado') || estadosMes.includes('validado'))
                  ? 'pagado'
                  : (becaActivaPupilo && mesNumero <= limiteMesDeuda)
                    ? 'pagado'
                  : (mesNumero < inicioCobroPupilo)
                    ? 'futuro-preingreso'
                    : (mesNumero > limiteMesDeuda)
                      ? 'futuro-calendario'
                  : (estadosMes.includes('pendiente') || estadosMes.includes('rechazado'))
                    ? 'pendiente'
                    : (mesNumero <= limiteMesDeuda ? 'pendiente' : 'futuro-calendario');

                return (
                <button
                  type="button"
                  key={mesNumero + pupilo.id}
                  onClick={() => toggleMesPupilo(pupilo.rut, mesNumero, estadoMes)}
                  className={`mes-box mes-${estadoMes} ${(mesesSeleccionados[pupilo.rut] || []).includes(mesNumero) ? 'seleccionado' : ''}`}
                  style={{ cursor: (estadoMes === 'pagado' || estadoMes === 'futuro-preingreso') ? 'not-allowed' : 'pointer' }}
                >
                  <span className="mes-box-nombre">{mes}</span>
                </button>
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
                <label className="checkbox-item"><input type="checkbox" checked={mesesSocioSeleccionados.length > 0} readOnly /> Pago Cuota Socio</label>
              )}
              <label className="checkbox-item"><input type="checkbox" checked={totalMesesJugadorSeleccionados > 0} readOnly /> Pago Cuota Deportista</label>
            </div>

            <div className="desglose-row"><span>Valor mensual perfil:</span><strong>${tarifaRedondeada.toLocaleString('es-CL')} / mes</strong></div>
            {esSocio && cuotaSocioAplicada > 0 && (
              <div className="desglose-row"><span>Cuota socio ({mesesSocioSeleccionados.length} {mesesSocioSeleccionados.length === 1 ? 'mes' : 'meses'}):</span><strong>${totalSocioSeleccionado.toLocaleString('es-CL')}</strong></div>
            )}
            <div className="desglose-row"><span>Cuota deportista(s) ({totalMesesJugadorSeleccionados} {totalMesesJugadorSeleccionados === 1 ? 'mes' : 'meses'}):</span><strong>${totalJugadorSeleccionado.toLocaleString('es-CL')}</strong></div>
            <div className="desglose-row total-calc"><span>Total a Pagar:</span><strong>${totalSeleccionado.toLocaleString('es-CL')}</strong></div>

            {totalMesesSeleccionados === 0 && (
              <div style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700', marginTop: '6px' }}>
                Selecciona meses pendientes o futuros (de la cuota socio, deportista, o ambas) para calcular y enviar la liquidación.
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
                disabled={subiendoComprobante || totalMesesSeleccionados === 0}
              >
                <Camera size={24} color="var(--gris-secundario)" strokeWidth={1.5} />
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
            <Clock size={40} color="var(--gris-secundario)" strokeWidth={1.5} style={{ margin: '0 auto' }} />
            <h3 style={{ color: '#FF9500', margin: '15px 0 10px 0', fontSize: '20px', fontWeight: '900' }}>Pago en Revisión</h3>
            <p style={{ fontSize: '14px', margin: 0, color: 'var(--texto-secundario)', lineHeight: '1.5' }}>Tesorería ha recibido tu comprobante. Será validado a la brevedad y recibirás una notificación.</p>
            <button className="btn-secondary mt-20" style={{ color: '#FF9500', background: 'rgba(255,149,0,0.1)' }} onClick={() => { setComprobanteSubido(false); setMesesSeleccionados({}); setMesesSocioSeleccionados([]); setMontoAbono(''); setArchivoComprobante(null); setErrorComprobante(''); }}>
              Entendido, volver
            </button>
          </div>
        )}
      </div>
        </>
      ) : (
        <div className="card mt-15 text-center" style={{ padding: '40px 20px', borderRadius: '22px' }}>
          <Search size={36} color="var(--gris-secundario)" strokeWidth={1.5} style={{ margin: '0 auto' }} />
          <h3 style={{ margin: '15px 0 8px 0', fontSize: '16px', fontWeight: '900', color: 'var(--texto-heading)' }}>Busca una cuenta para revisar</h3>
          <p style={{ fontSize: '13px', margin: 0, color: 'var(--texto-secundario)', lineHeight: '1.5' }}>
            Usa el buscador de arriba para encontrar por nombre, RUT o correo de un jugador, socio o apoderado.
          </p>
        </div>
      )}
    </div>
  );
}

export default PerfilTesoreriaPanel;

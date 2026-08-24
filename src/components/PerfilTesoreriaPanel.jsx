import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, Clock, LayoutGrid, List, Plus, Search, User, X } from 'lucide-react';
import { calcularCuotaDeportistasFamilia, noDebeMensualidad, obtenerCuotaJugador } from '../utils/beca';
import { showToast } from '../utils/toast';
import * as api from '../api/client';
import LogoAvatar from './LogoAvatar';
import { normalizarRol } from '../security/accessControl';

function PerfilTesoreriaPanel({
  pupiloActivo,
  setPupiloActivo,
  rolUsuario,
  pupilosDisponibles,
  cuentasAdmin,
  pagosMensualidadesAdmin,
  morososAdmin,
  sociosMorosos,
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
  onIrAPagoManual,
  onIrABecas,
  utmVigente,
  utmHistorico,
}) {
  const [archivoComprobante, setArchivoComprobante] = useState(null);
  const inputComprobanteRef = useRef(null);
  const [subiendoComprobante, setSubiendoComprobante] = useState(false);
  const [errorComprobante, setErrorComprobante] = useState('');
  const [busquedaCuenta, setBusquedaCuenta] = useState('');
  // Cuenta seleccionada directo (sin pasar por un jugador) — necesario para
  // poder revisar la Tesorería de un socio que no tiene ningún deportista
  // asociado, caso que "cuentaActual" antes no contemplaba en absoluto.
  const [cuentaSocioActiva, setCuentaSocioActiva] = useState(null);
  // mesesSeleccionados (prop, { [rutPupilo]: number[] }) representa la
  // grilla de Mensualidad Deportista, con selección independiente por
  // pupilo; la de Cuota Socio es independiente para que el socio/apoderado
  // pueda pagar solo una, solo la otra, o ambas.
  const [mesesSocioSeleccionados, setMesesSocioSeleccionados] = useState([]);

  const esVistaAdmin = rolUsuario === 'admin' || rolUsuario === 'super_admin';

  const normalizarTextoBusqueda = (texto = '') => String(texto || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const normalizarRutCuenta = (rut = '') => String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();

  const resultadosBusqueda = useMemo(() => {
    const termino = normalizarTextoBusqueda(busquedaCuenta);
    if (!esVistaAdmin || termino.length < 2) return [];

    const cuentasPorCorreo = new Map(
      (Array.isArray(cuentasAdmin) ? cuentasAdmin : []).map((c) => [String(c.correo || '').trim().toLowerCase(), c])
    );

    const resultadosJugador = (Array.isArray(pupilosDisponibles) ? pupilosDisponibles : [])
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
        tipo: 'jugador',
        jugador: j,
        cuenta: cuentasPorCorreo.get(String(j.correo_apoderado || '').trim().toLowerCase()) || null,
      }));

    // Socios sin ningún deportista asociado son invisibles en pupilosDisponibles
    // (no hay ningún jugador desde el cual encontrarlos) — se buscan directo en
    // cuentasAdmin, excluyendo las que ya aparecen vía un resultado-jugador de
    // arriba para no duplicar la misma familia dos veces.
    const rutsCuentaYaEncontrados = new Set(
      resultadosJugador.map((r) => normalizarRutCuenta(r.cuenta?.rut || '')).filter(Boolean)
    );
    const resultadosCuenta = (Array.isArray(cuentasAdmin) ? cuentasAdmin : [])
      .filter((c) => c.es_socio && !rutsCuentaYaEncontrados.has(normalizarRutCuenta(c.rut || '')))
      .filter((c) => {
        const camposTexto = [c.nombres, c.apellido_paterno, c.rut, c.correo].map(normalizarTextoBusqueda).join(' ');
        return camposTexto.includes(termino);
      })
      .slice(0, 10)
      .map((c) => ({ tipo: 'cuenta', cuenta: c }));

    return [...resultadosJugador, ...resultadosCuenta];
  }, [busquedaCuenta, esVistaAdmin, cuentasAdmin, pupilosDisponibles]);

  const seleccionarResultadoBusqueda = (resultado) => {
    if (resultado.tipo === 'cuenta') {
      setCuentaSocioActiva(resultado.cuenta);
      if (typeof setPupiloActivo === 'function') setPupiloActivo(null);
    } else {
      setCuentaSocioActiva(null);
      if (typeof setPupiloActivo === 'function') setPupiloActivo(resultado.jugador);
    }
    setBusquedaCuenta('');
  };

  const mesesBase = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const anioObjetivo = 2026;
  // cuentaSocioActiva gana siempre que exista: es una selección explícita de
  // un socio sin deportistas (ver seleccionarResultadoBusqueda). Si no, se
  // deriva del pupilo activo como antes.
  const cuentaActual = cuentaSocioActiva || (Array.isArray(cuentasAdmin)
    ? cuentasAdmin.find((cuenta) => {
      const rutCuenta = normalizarRutCuenta(cuenta.rut || '');
      const rutApoderado = normalizarRutCuenta(pupiloActivo?.rut_apoderado || '');
      if (rutCuenta && rutApoderado && rutCuenta === rutApoderado) return true;

      const correoCuenta = String(cuenta.correo || '').trim().toLowerCase();
      const correoApoderado = String(pupiloActivo?.correo_apoderado || '').trim().toLowerCase();
      return Boolean(correoCuenta && correoApoderado && correoCuenta === correoApoderado);
    }) || null
    : null);
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
  // normalizarRol colapsa 'socio-apoderado' (guión) a 'socio_apoderado' —
  // antes esta comparación solo miraba la forma con guión bajo, así que una
  // cuenta guardada con guión no disparaba el reparto de cuota socio+hijos.
  const perfilPrincipal = normalizarRol(cuentaActual?.perfil_principal || cuentaActual?.rol || '');
  const esSocio = Boolean(cuentaActual?.es_socio) || ['socio', 'socio_apoderado', 'directiva'].includes(perfilPrincipal);
  const esSocioApoderado = perfilPrincipal === 'socio_apoderado';

  // Sin pupilo (socio revisado directo, sin deportistas) la deuda no vive en
  // morososAdmin (deuda de jugadores) sino en sociosMorosos (deuda de cuota
  // de socio), buscada por el rut de la cuenta en vez del rut del pupilo.
  const morosoActivo = rutPupiloActivoNormalizado
    ? (morososAdmin || []).find((m) => normalizarRutComparacion(m?.rut || '') === rutPupiloActivoNormalizado) || null
    : (sociosMorosos || []).find((s) => normalizarRutComparacion(s?.rut || '') === rutCuentaNormalizado) || null;
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
    const rutJugadorPago = normalizarRutComparacion(p.rut_jugador);
    const rutPagadorPago = normalizarRutComparacion(p.rut_pagos);

    if (rutPupiloActivo) {
      if (rutJugadorPago && rutJugadorPago === rutPupiloActivoNormalizado) return true;
      if (rutPagadorPago && rutPagadorPago === rutPupiloActivoNormalizado) return true;
    }

    // Pagos de "solo cuota de socio" (sin deportista, rut_jugador vacío) se
    // ligan por rut_pagos a la propia cuenta — no dependen de que haya un
    // pupilo seleccionado (antes el "if (!rutPupiloActivo) return false" de
    // arriba cortaba esto en seco para un socio sin ningún hijo).
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

  const now = new Date();
  const fechaCorte = new Date(now.getFullYear(), now.getMonth(), 0);
  const fechaCorteTexto = fechaCorte.toLocaleDateString('es-CL');

  const utmActual = Number(cuentaActual?.utm_valor_referencia || utmVigente?.valor || 71649);
  const cuotaSocioBase = Number(cuentaActual?.monto_mensual_base || 0);
  const cuotaSocio = Math.round(cuotaSocioBase > 0 ? cuotaSocioBase : (utmActual * 0.3));

  // La UTM varía mes a mes — pagar junio+julio+agosto junto no es 3 veces la
  // cuota de HOY, es la suma de la cuota real de cada mes (0,3 UTM del corte
  // de ESE mes). Mismo criterio que construirSociosMorosos en App.jsx.
  const utmOverrideCuenta = Number(cuentaActual?.utm_valor_referencia || 0);
  const obtenerCuotaSocioDelMes = (mesNum) => {
    if (cuotaSocioBase > 0) return cuotaSocioBase;
    if (utmOverrideCuenta > 0) return Math.round(utmOverrideCuenta * 0.3);
    const utmDelMes = Number(utmHistorico?.[mesNum]) || Number(utmVigente?.valor) || 71649;
    return Math.round(utmDelMes * 0.3);
  };

  // Excepción acordada/beca: aplica solo a la parte deportistas, nunca a la cuota socio.
  const montoAcordadoFamilia = Number(cuentaActual?.monto_mensual_override || 0);
  const { cuotaDeportistas, cuotaReferencial: cuotaDeportistaReferencial } = calcularCuotaDeportistasFamilia({
    pupilosFamilia: pupilosActivos,
    esSocioApoderado,
    montoAcordado: montoAcordadoFamilia,
  });
  const cuotaSocioAplicada = esSocio ? cuotaSocio : 0;
  const tarifaMensual = cuotaSocioAplicada + cuotaDeportistas;
  const condicionesPagoPerfil = String(cuentaActual?.condiciones_pago || '').trim();

  // Cuota mensual real de UN pupilo: si la ficha trae valor_mensualidad
  // propio (caso normal, viene de la hoja) se usa tal cual; si no, se reparte
  // en partes iguales la tarifa agregada (mismo criterio que "Cuota vigente").
  // Ver obtenerCuotaJugador en utils/beca — mismo cálculo que usa Morosos.
  const obtenerCuotaMensualPupilo = (pupilo = {}) => obtenerCuotaJugador(pupilo, cuotaDeportistaReferencial);

  const tarifaRedondeada = Math.round(tarifaMensual);
  const totalSocioSeleccionado = esSocio
    ? mesesSocioSeleccionados.reduce((suma, mesNum) => suma + obtenerCuotaSocioDelMes(mesNum), 0)
    : 0;
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

  const enviarComprobantePago = async (archivoDirecto) => {
    // archivoDirecto: el <input type="file"> llama esto en su propio onChange
    // pasando el File recién elegido, para que se envíe de inmediato en un
    // solo paso (elegir archivo = enviar) sin esperar a que el state
    // archivoComprobante termine de propagarse (evita leer un valor viejo).
    const archivo = archivoDirecto || archivoComprobante;
    if (totalMesesSeleccionados === 0) {
      setErrorComprobante('Selecciona al menos un mes (cuota socio, deportista, o ambas) para registrar el pago.');
      return;
    }

    if (!archivo) {
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
      if (String(archivo.type || '').startsWith('image/')) {
        const formData = new FormData();
        formData.append('nombre', `comprobante-${rutPupiloActivo || Date.now()}`);
        formData.append('tipo', 'comprobante');
        formData.append('archivo', archivo);
        const uploadRes = await api.assetsAPI.uploadLogo(formData);
        comprobanteUrl = uploadRes?.url || '';
      } else {
        comprobanteUrl = await convertirArchivoABase64(archivo);
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
      // montoPorDefecto puede ser un número fijo (deportistas, no depende de
      // UTM) o una función (mesNum) => monto (cuota socio: cada mes puede
      // tener su propia UTM de corte, así que cada fila de pago se guarda
      // con el monto REAL de ese mes específico, no uno único repetido.
      const crearPagosPara = async (meses, concepto, montoPorDefecto, rutJugadorPago) => {
        const mesesOrdenados = [...meses].sort((a, b) => a - b);
        for (const mesNumero of mesesOrdenados) {
          const mesTexto = String(mesesBase[mesNumero - 1] || '').toLowerCase();
          const montoDelMes = typeof montoPorDefecto === 'function' ? montoPorDefecto(mesNumero) : montoPorDefecto;
          const pagoCreado = await api.pagosMensualidadesAPI.create({
            ...payloadBase,
            rut_jugador: rutJugadorPago,
            concepto_pago: concepto,
            meses_correspondientes: `${mesTexto}-${anioObjetivo}`,
            monto_total_pagado: montoUnitarioAbono !== null && montoUnitarioAbono > 0 ? montoUnitarioAbono : montoDelMes,
          });
          pagosCreados.push(pagoCreado);
        }
      };

      await crearPagosPara(mesesSocioSeleccionados, 'Mensualidad Socio', obtenerCuotaSocioDelMes, rutPupiloActivo);

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
      {esVistaAdmin && rolUsuario === 'super_admin' && onIrAPagoManual && (
        <div className="card mb-15" style={{ borderRadius: '18px', border: '1px solid rgba(0,122,255,0.25)', background: 'rgba(0,122,255,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div>
              <h4 className="form-subtitle" style={{ marginBottom: '4px' }}>Pago manual</h4>
              <p style={{ fontSize: '12px', color: 'var(--texto-secundario)', margin: 0 }}>
                Registra un pago ya confirmado (efectivo, transferencia) sin pasar por la bandeja de validación.
              </p>
            </div>
            <button
              type="button"
              onClick={onIrAPagoManual}
              style={{
                padding: '10px 16px', background: 'var(--azul-electrico)', color: 'white', border: 'none',
                borderRadius: '8px', fontWeight: '600', fontSize: '12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
              }}
            >
              <Plus size={14} /> Registrar pago manual
            </button>
          </div>
        </div>
      )}
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
              {resultadosBusqueda.map((r) => {
                const esCuenta = r.tipo === 'cuenta';
                const nombrePrincipal = esCuenta ? `${r.cuenta.nombres || ''} ${r.cuenta.apellido_paterno || ''}`.trim() || 'Socio' : (r.jugador.nombre || 'Jugador');
                const rutPrincipal = esCuenta ? (r.cuenta.rut || 'Sin RUT') : (r.jugador.rut || 'Sin RUT');
                const detalle = esCuenta
                  ? 'Socio sin deportistas asociados'
                  : (r.cuenta ? `Apoderado: ${r.cuenta.nombres || ''} ${r.cuenta.apellido_paterno || ''}`.trim() : '');
                return (
                  <button
                    type="button"
                    key={esCuenta ? r.cuenta.rut : (r.jugador.rut || r.jugador.id)}
                    onClick={() => seleccionarResultadoBusqueda(r)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '14px', border: '1px solid var(--borde-suave)', background: 'rgba(0,122,255,0.04)', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <User size={18} color="var(--azul-electrico)" />
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', fontSize: '13px', color: 'var(--texto-principal)' }}>{nombrePrincipal}</strong>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                        {rutPrincipal}{detalle ? ` · ${detalle}` : ''}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {busquedaCuenta.length >= 2 && resultadosBusqueda.length === 0 && (
            <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '700' }}>Sin resultados para "{busquedaCuenta}".</p>
          )}

          {(pupiloActivo || cuentaSocioActiva) && (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--borde-suave)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
                Revisando cuenta de: <strong style={{ color: 'var(--texto-principal)' }}>
                  {pupiloActivo ? pupiloActivo.nombre : `${cuentaSocioActiva.nombres || ''} ${cuentaSocioActiva.apellido_paterno || ''}`.trim()}
                </strong>
              </span>
              <button type="button" className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => { setPupiloActivo(null); setCuentaSocioActiva(null); }}>
                Cambiar búsqueda
              </button>
            </div>
          )}
        </div>
      )}

      {esVistaAdmin && onIrABecas && (
        <button
          type="button"
          onClick={onIrABecas}
          className="card mt-15"
          style={{ borderRadius: '22px', padding: '14px', width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', border: 'none' }}
        >
          <div>
            <h4 className="form-subtitle" style={{ marginBottom: '4px' }}>Becas de deportistas</h4>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--texto-secundario)' }}>
              Ver la lista completa de becados, otorgar una nueva o ajustar el % y la vigencia de una existente.
            </p>
          </div>
          <span style={{ fontSize: '20px', color: 'var(--azul-electrico)', flexShrink: 0 }}>→</span>
        </button>
      )}

      {(!esVistaAdmin || pupiloActivo || cuentaSocioActiva) ? (
        <>
      <div className="status-account-card payment-overview-card mt-15" style={{ borderRadius: '28px', boxShadow: '0 16px 34px rgba(15,23,42,0.10)' }}>
        <div className="status-header">
          <div>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mensualidad / Perfil</span>
            <h3 className="status-titular" style={{ color: 'white' }}>{titular}</h3>
            <span className="status-rol">{esSocio ? 'Socio Activo Club Cultura Física' : 'Apoderado Base'}</span>
            {esSocio && (
              <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700', display: 'block', marginTop: '5px' }}>
                UTM referencia ({fechaCorteTexto}): ${utmActual.toLocaleString('es-CL')} · Cuota socio (0,3 UTM): ${cuotaSocio.toLocaleString('es-CL')}
                {cuotaDeportistas > 0 && (
                  <> + ${cuotaDeportistas.toLocaleString('es-CL')} por deportistas a cargo = <strong style={{ color: 'white' }}>${tarifaRedondeada.toLocaleString('es-CL')}/mes</strong></>
                )}
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
              <span style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Total Adeudado</span>
              {/* morosoActivo.montoDeuda ya suma la cuota REAL de cada mes (0,3 UTM
                  del corte de ese mes en el caso socio) — antes acá se aproximaba
                  con tarifaRedondeada × mesesAtraso (la cuota de HOY repetida),
                  que no coincidía con el total real cuando la UTM varió entre medio. */}
              <strong style={{ fontSize: '20px', color: 'var(--rojo-alerta)', fontWeight: '900' }}>-${Number(morosoActivo?.montoDeuda ?? (tarifaRedondeada * mesesAtraso)).toLocaleString('es-CL')}</strong>
            </div>
          </div>
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,59,48,0.15)', fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '700' }}>
            <span>Cuota mensual vigente: <strong style={{ color: 'var(--texto-principal)' }}>${tarifaRedondeada.toLocaleString('es-CL')}</strong></span>
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

        {esVistaAdmin && cuentaActual && pupilosActivos.length === 0 && (
          <p style={{ margin: '0 0 15px 0', fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: '700', fontStyle: 'italic' }}>
            Este socio no tiene deportistas asociados — solo aplica la Cuota de Socio de arriba.
          </p>
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
              {/* Un solo botón: al tocarlo abre el selector nativo de archivos
                  (galería/cámara/PDF), y apenas se elige uno se envía solo —
                  sin un segundo click de "enviar" aparte. El <input> real
                  queda oculto, el botón grande es lo único que se toca. */}
              <input
                ref={inputComprobanteRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const archivo = e.target.files?.[0] || null;
                  setArchivoComprobante(archivo);
                  if (archivo) void enviarComprobantePago(archivo);
                  e.target.value = '';
                }}
              />

              {archivoComprobante && subiendoComprobante && (
                <span style={{ display: 'block', marginBottom: '8px', fontSize: '11px', color: 'var(--azul-electrico)', fontWeight: '700' }}>
                  Enviando: {archivoComprobante.name}
                </span>
              )}

              {errorComprobante && (
                <div style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--rojo-alerta)', fontWeight: '700' }}>
                  {errorComprobante}
                </div>
              )}

              <button
                className="btn-pago-cta"
                style={{ width: '100%', border: 'none', cursor: subiendoComprobante ? 'wait' : 'pointer', opacity: subiendoComprobante ? 0.8 : 1, padding: '14px 16px', borderRadius: '14px' }}
                onClick={() => inputComprobanteRef.current?.click()}
                disabled={subiendoComprobante || totalMesesSeleccionados === 0}
              >
                <Camera size={24} color="var(--gris-secundario)" strokeWidth={1.5} />
                <div>
                  <strong style={{ display: 'block', fontSize: '14px' }}>{subiendoComprobante ? 'Enviando comprobante...' : 'Adjuntar y Enviar Comprobante'}</strong>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>JPG, PNG, WEBP o PDF · Tesorería validará y marcará en verde los meses aprobados.</span>
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

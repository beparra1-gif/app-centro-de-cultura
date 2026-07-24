import { useEffect, useMemo, useState } from 'react';
import { FileDown, ShieldAlert, Wallet, TrendingUp, TrendingDown, Lock, User, Ticket, Trash2, Banknote, Smartphone, NotebookPen, BookOpen, XCircle, Search, PlusCircle, History, AlertTriangle, BarChart3, Pencil, Check, ChevronDown, ChevronUp, LayoutGrid, List } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { getColorPorCategoria } from '../utils/appHelpers';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import { kioscoAPI } from '../api/client';
import SignaturePad from './SignaturePad';

const hoyISO = () => new Date().toISOString().slice(0, 10);

let logoClubDataUrlCache = null;
const LOGO_PDF_TAMANO_PX = 160; // suficiente para nitidez a 46pt de ancho en el PDF, sin inflar el archivo
const cargarLogoClubDataUrl = () => {
  if (logoClubDataUrlCache) return Promise.resolve(logoClubDataUrlCache);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = LOGO_PDF_TAMANO_PX;
        canvas.height = LOGO_PDF_TAMANO_PX;
        const ctx = canvas.getContext('2d');
        const escala = Math.min(LOGO_PDF_TAMANO_PX / img.naturalWidth, LOGO_PDF_TAMANO_PX / img.naturalHeight);
        const anchoDestino = img.naturalWidth * escala;
        const altoDestino = img.naturalHeight * escala;
        ctx.drawImage(
          img,
          (LOGO_PDF_TAMANO_PX - anchoDestino) / 2,
          (LOGO_PDF_TAMANO_PX - altoDestino) / 2,
          anchoDestino,
          altoDestino
        );
        logoClubDataUrlCache = canvas.toDataURL('image/png');
        resolve(logoClubDataUrlCache);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = '/logos/club-logo.png';
  });
};

const inicioSemanaISO = () => {
  const d = new Date();
  const dia = d.getDay();
  const diff = dia === 0 ? 6 : dia - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
};

const inicioMesISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

function KioscoPanel({ nombreResponsable = '' }) {
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState('pos');

  const [turno, setTurno] = useState(null);
  const [formApertura, setFormApertura] = useState({ responsable: nombreResponsable, dia: hoyISO(), montoInicial: '' });

  const [productos, setProductos] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [modalPago, setModalPago] = useState(null);
  const [montoRecibido, setMontoRecibido] = useState('');
  const [ticketActual, setTicketActual] = useState(1);

  const [cajaEfectivoKiosco, setCajaEfectivoKiosco] = useState(0);
  const [cajaTransferKiosco, setCajaTransferKiosco] = useState(0);
  const [cajaEfectivoEntradas, setCajaEfectivoEntradas] = useState(0);
  const [cajaTransferEntradas, setCajaTransferEntradas] = useState(0);

  const [egresos, setEgresos] = useState([]);
  const [gastoRegistro, setGastoRegistro] = useState({ desc: '', monto: '' });
  const [modalEgreso, setModalEgreso] = useState(false);
  const [receptorEgreso, setReceptorEgreso] = useState({ nombre: '', apellido: '', rut: '' });
  const [firmaEgreso, setFirmaEgreso] = useState(null);
  const [registrandoEgreso, setRegistrandoEgreso] = useState(false);

  const [nuevoProducto, setNuevoProducto] = useState({ nombre: '', emoji: '', costo: '', precio: '', categoria: 'Bebida', talla: '' });
  const [vistaProductos, setVistaProductos] = useState('grid');
  const [productoEditandoId, setProductoEditandoId] = useState(null);

  const [fiados, setFiados] = useState([]);
  const [fiadoModo, setFiadoModo] = useState('nueva');
  const [fiadoBusqueda, setFiadoBusqueda] = useState('');
  const [fiadoSeleccionadoId, setFiadoSeleccionadoId] = useState(null);
  const [nombreFiado, setNombreFiado] = useState('');
  const [detalleFiado, setDetalleFiado] = useState('');

  const [analiticaDesde, setAnaliticaDesde] = useState(hoyISO());
  const [analiticaHasta, setAnaliticaHasta] = useState(hoyISO());
  const [ventasAnalitica, setVentasAnalitica] = useState([]);
  const [cargandoAnalitica, setCargandoAnalitica] = useState(false);

  const [modalCierre, setModalCierre] = useState(false);
  const [firmaCierre, setFirmaCierre] = useState(null);
  const [nombreCierre, setNombreCierre] = useState('');
  const [cerrandoTurno, setCerrandoTurno] = useState(false);

  const [historialTurnos, setHistorialTurnos] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [historialDesde, setHistorialDesde] = useState('');
  const [historialHasta, setHistorialHasta] = useState('');
  const [turnoDetalleId, setTurnoDetalleId] = useState(null);
  const [detalleTurno, setDetalleTurno] = useState({ egresos: [], ventas: [] });
  const [cargandoDetalleTurno, setCargandoDetalleTurno] = useState(false);
  const [exportandoTurnoId, setExportandoTurnoId] = useState(null);

  const totalCarrito = carrito.reduce((a, b) => a + (b.precio * b.cant), 0);
  const totalGastos = egresos.reduce((a, b) => a + Number(b.monto || 0), 0);
  const totalPendientes = fiados.reduce((a, b) => a + Number(b.monto_total || 0), 0);
  const cajaNetaFinal = (Number(turno?.monto_inicial) || 0) + cajaEfectivoKiosco + cajaEfectivoEntradas - totalGastos;

  const cargarProductos = async () => {
    const data = await kioscoAPI.productos.getAll();
    setProductos(data);
  };

  const cargarFiados = async () => {
    const data = await kioscoAPI.fiados.getAll({ estado: 'abierto' });
    setFiados(data);
  };

  const cargarEgresosTurno = async (turnoId) => {
    if (!turnoId) { setEgresos([]); return; }
    const data = await kioscoAPI.egresos.getAll({ turno_id: turnoId });
    setEgresos(data);
  };

  useEffect(() => {
    (async () => {
      try {
        setCargando(true);
        const [turnoActual] = await Promise.all([kioscoAPI.turnos.getActual(), cargarProductos(), cargarFiados()]);
        if (turnoActual) {
          setTurno(turnoActual);
          setTicketActual((turnoActual.ticket_final || 0) + 1);
          setCajaEfectivoKiosco(Number(turnoActual.total_efectivo_ventas || 0));
          setCajaTransferKiosco(Number(turnoActual.total_transferencia_ventas || 0));
          await cargarEgresosTurno(turnoActual.id);
        }
      } catch (err) {
        showToast({ message: err.message || 'No se pudo cargar el kiosco.', type: 'error' });
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (vista !== 'analitica') return;
    (async () => {
      try {
        setCargandoAnalitica(true);
        const data = await kioscoAPI.ventas.getAll({ desde: analiticaDesde, hasta: analiticaHasta });
        setVentasAnalitica(data);
      } catch (err) {
        showToast({ message: err.message || 'No se pudo cargar la analítica.', type: 'error' });
      } finally {
        setCargandoAnalitica(false);
      }
    })();
  }, [vista, analiticaDesde, analiticaHasta]);

  useEffect(() => {
    if (vista !== 'historial') return;
    (async () => {
      try {
        setCargandoHistorial(true);
        const filtros = { estado: 'cerrado' };
        if (historialDesde) filtros.desde = historialDesde;
        if (historialHasta) filtros.hasta = historialHasta;
        const data = await kioscoAPI.turnos.getAll(filtros);
        setHistorialTurnos(data);
      } catch (err) {
        showToast({ message: err.message || 'No se pudo cargar el historial.', type: 'error' });
      } finally {
        setCargandoHistorial(false);
      }
    })();
  }, [vista, historialDesde, historialHasta]);

  const alternarDetalleTurno = async (turnoHist) => {
    if (turnoDetalleId === turnoHist.id) {
      setTurnoDetalleId(null);
      return;
    }
    setTurnoDetalleId(turnoHist.id);
    setCargandoDetalleTurno(true);
    try {
      const [egresosData, ventasData] = await Promise.all([
        kioscoAPI.egresos.getAll({ turno_id: turnoHist.id }),
        kioscoAPI.ventas.getAll({ turno_id: turnoHist.id }),
      ]);
      setDetalleTurno({ egresos: egresosData, ventas: ventasData });
    } catch (err) {
      showToast({ message: err.message || 'No se pudo cargar el detalle del turno.', type: 'error' });
    } finally {
      setCargandoDetalleTurno(false);
    }
  };

  const exportarTurnoHistorial = async (turnoHist) => {
    setExportandoTurnoId(turnoHist.id);
    try {
      const [egresosData, ventasData] = await Promise.all([
        kioscoAPI.egresos.getAll({ turno_id: turnoHist.id }),
        kioscoAPI.ventas.getAll({ turno_id: turnoHist.id }),
      ]);
      await exportarCajaPdf({
        dia: turnoHist.dia,
        responsable: turnoHist.responsable,
        montoInicial: turnoHist.monto_inicial,
        cerradoPor: turnoHist.cerrado_por,
        firma: turnoHist.firma_base64,
        ticketFinal: turnoHist.ticket_final,
        cajaEfectivoKiosco: turnoHist.total_efectivo_ventas,
        cajaTransferKiosco: turnoHist.total_transferencia_ventas,
        cajaEfectivoEntradas: 0,
        cajaTransferEntradas: 0,
        totalEgresos: turnoHist.total_egresos,
        cajaNetaFinal: turnoHist.caja_neta_final,
        totalPendientes: turnoHist.total_pendientes,
        egresosDetalle: egresosData,
        fiadosDetalle: [],
        ventasParaRanking: ventasData,
      });
    } catch (err) {
      showToast({ message: err.message || 'No se pudo exportar el cierre.', type: 'error' });
    } finally {
      setExportandoTurnoId(null);
    }
  };

  const eliminarTurnoHistorial = async (turnoHist) => {
    if (!(await confirmAction({
      title: 'Eliminar cierre del historial',
      message: `¿Eliminar el cierre del ${String(turnoHist.dia).slice(0, 10)} (cerrado por ${turnoHist.cerrado_por || 'N/D'})? Las ventas y egresos de ese turno se conservan, solo se borra el registro del cierre.`,
      danger: true,
      confirmText: 'Eliminar',
    }))) {
      return;
    }
    try {
      await kioscoAPI.turnos.remove(turnoHist.id);
      setHistorialTurnos((prev) => prev.filter((t) => t.id !== turnoHist.id));
      if (turnoDetalleId === turnoHist.id) setTurnoDetalleId(null);
      showToast({ message: 'Cierre eliminado del historial.', type: 'success' });
    } catch (err) {
      showToast({ message: err.message || 'No se pudo eliminar el cierre.', type: 'error' });
    }
  };

  const rankingVentas = useMemo(() => {
    const acumulado = new Map();
    ventasAnalitica.forEach((v) => {
      const clave = v.producto_nombre;
      const prev = acumulado.get(clave) || { nombre: clave, cantidad: 0, monto: 0 };
      prev.cantidad += Number(v.cantidad || 0);
      prev.monto += Number(v.subtotal || 0);
      acumulado.set(clave, prev);
    });
    return Array.from(acumulado.values()).sort((a, b) => b.cantidad - a.cantidad);
  }, [ventasAnalitica]);

  const totalRecaudadoAnalitica = ventasAnalitica.reduce((a, b) => a + Number(b.subtotal || 0), 0);

  const abrirTurno = async () => {
    try {
      const nuevo = await kioscoAPI.turnos.abrir({
        responsable: formApertura.responsable,
        dia: formApertura.dia,
        monto_inicial: Number(formApertura.montoInicial) || 0,
      });
      setTurno(nuevo);
      setTicketActual(1);
      setCajaEfectivoKiosco(0);
      setCajaTransferKiosco(0);
      setCajaEfectivoEntradas(0);
      setCajaTransferEntradas(0);
      setEgresos([]);
    } catch (err) {
      showToast({ message: err.message || 'No se pudo abrir el turno.', type: 'error' });
    }
  };

  const agregarAlCarrito = (prod) => {
    if (prod.stock <= 0) {
      showToast({ message: `${prod.nombre}: sin stock para vender.`, type: 'error' });
      return;
    }
    const enCarrito = carrito.find((i) => i.id === prod.id)?.cant || 0;
    if (enCarrito + 1 > prod.stock) {
      showToast({ message: `${prod.nombre}: no queda más stock disponible.`, type: 'error' });
      return;
    }
    const elem = document.getElementById(`prod-${prod.id}`);
    if (elem) { elem.style.transform = 'scale(0.9)'; setTimeout(() => { elem.style.transform = 'scale(1)'; }, 100); }
    const existente = carrito.find((i) => i.id === prod.id);
    if (existente) {
      setCarrito(carrito.map((i) => (i.id === prod.id ? { ...i, cant: i.cant + 1 } : i)));
    } else {
      setCarrito([...carrito, { ...prod, cant: 1 }]);
    }
  };

  const abrirModalPago = (tipo) => {
    if (!turno) {
      showToast({ message: 'Abre la caja antes de cobrar (nombre, fecha y monto inicial).', type: 'error' });
      setVista('caja');
      return;
    }
    setModalPago(tipo);
  };

  const registrarVentasCarrito = async (metodoPago) => {
    let sEK = 0;
    let sTK = 0;
    let sEE = 0;
    let sTE = 0;

    for (const item of carrito) {
      await kioscoAPI.ventas.create({
        turno_id: turno?.id || null,
        ticket_numero: ticketActual,
        producto_id: item.id,
        producto_nombre: item.talla ? `${item.nombre} (${item.talla})` : item.nombre,
        cantidad: item.cant,
        precio_unitario: item.precio,
        subtotal: item.precio * item.cant,
        metodo_pago: metodoPago,
      });
      const sub = item.precio * item.cant;
      const esEntrada = item.categoria === 'Entradas';
      if (metodoPago === 'efectivo') {
        if (esEntrada) sEE += sub; else sEK += sub;
      } else if (metodoPago === 'transferencia') {
        if (esEntrada) sTE += sub; else sTK += sub;
      }
    }

    return { sEK, sTK, sEE, sTE };
  };

  const finalizarDespachoPOS = async (metodo) => {
    try {
      const { sEK, sTK, sEE, sTE } = await registrarVentasCarrito(metodo);
      if (sEK > 0) setCajaEfectivoKiosco((p) => p + sEK);
      if (sTK > 0) setCajaTransferKiosco((p) => p + sTK);
      if (sEE > 0) setCajaEfectivoEntradas((p) => p + sEE);
      if (sTE > 0) setCajaTransferEntradas((p) => p + sTE);

      setTicketActual((t) => t + 1);
      setCarrito([]);
      setModalPago(null);
      setMontoRecibido('');
      await cargarProductos();
      showToast({ message: `Ticket #${ticketActual.toString().padStart(3, '0')} generado con éxito.`, type: 'success' });
    } catch (err) {
      showToast({ message: err.message || 'No se pudo registrar la venta.', type: 'error' });
    }
  };

  const registrarCuentaPendiente = async (e) => {
    e.preventDefault();
    if (fiadoModo === 'existente' && !fiadoSeleccionadoId) {
      showToast({ message: 'Selecciona una cuenta pendiente existente.', type: 'error' });
      return;
    }
    if (fiadoModo === 'nueva' && !nombreFiado.trim()) {
      showToast({ message: 'Ingresa el nombre del responsable.', type: 'error' });
      return;
    }
    try {
      await registrarVentasCarrito('fiado');
      await kioscoAPI.fiados.cargo({
        fiado_id: fiadoModo === 'existente' ? fiadoSeleccionadoId : null,
        nombre: fiadoModo === 'nueva' ? nombreFiado.trim() : undefined,
        detalle: detalleFiado || carrito.map((i) => `${i.cant}x ${i.nombre}`).join(', '),
        monto: totalCarrito,
        turno_id: turno?.id || null,
        ticket_numero: ticketActual,
      });

      setCarrito([]);
      setModalPago(null);
      setNombreFiado('');
      setDetalleFiado('');
      setFiadoSeleccionadoId(null);
      setFiadoBusqueda('');
      setFiadoModo('nueva');
      setTicketActual((t) => t + 1);
      await Promise.all([cargarProductos(), cargarFiados()]);
      showToast({ message: 'La cuenta ha sido registrada en Pendientes.', type: 'success' });
    } catch (err) {
      showToast({ message: err.message || 'No se pudo registrar la cuenta pendiente.', type: 'error' });
    }
  };

  const pagarFiado = async (fiado, metodo) => {
    if (!turno) {
      showToast({ message: 'Abre la caja antes de registrar pagos (nombre, fecha y monto inicial).', type: 'error' });
      setVista('caja');
      return;
    }
    const etiqueta = metodo === 'efectivo' ? 'EFECTIVO' : 'TRANSFERENCIA';
    if (!(await confirmAction({ title: 'Confirmar pago', message: `¿Deuda de ${fiado.nombre} ($${Number(fiado.monto_total).toLocaleString('es-CL')}) cancelada por ${etiqueta}?` }))) {
      return;
    }
    try {
      await kioscoAPI.fiados.pago(fiado.id, { monto: fiado.monto_total, metodo_pago: metodo, turno_id: turno?.id || null });
      if (metodo === 'efectivo') setCajaEfectivoKiosco((p) => p + Number(fiado.monto_total));
      else setCajaTransferKiosco((p) => p + Number(fiado.monto_total));
      await cargarFiados();
      showToast({ message: 'Pago registrado correctamente.', type: 'success' });
    } catch (err) {
      showToast({ message: err.message || 'No se pudo registrar el pago.', type: 'error' });
    }
  };

  const abrirModalEgreso = () => {
    if (!gastoRegistro.desc || !gastoRegistro.monto) {
      showToast({ message: 'Ingresa la glosa y el monto del egreso.', type: 'error' });
      return;
    }
    setReceptorEgreso({ nombre: '', apellido: '', rut: '' });
    setFirmaEgreso(null);
    setModalEgreso(true);
  };

  const registrarEgreso = async () => {
    if (!receptorEgreso.nombre.trim() || !receptorEgreso.apellido.trim() || !receptorEgreso.rut.trim()) {
      showToast({ message: 'Indica nombre, apellido y RUT de quien recibe el dinero.', type: 'error' });
      return;
    }
    if (!firmaEgreso) {
      showToast({ message: 'Se requiere la firma de quien recibe el dinero.', type: 'error' });
      return;
    }
    setRegistrandoEgreso(true);
    try {
      await kioscoAPI.egresos.create({
        turno_id: turno?.id || null,
        descripcion: gastoRegistro.desc,
        monto: Number(gastoRegistro.monto),
        nombre_receptor: receptorEgreso.nombre.trim(),
        apellido_receptor: receptorEgreso.apellido.trim(),
        rut_receptor: receptorEgreso.rut.trim(),
        firma_receptor: firmaEgreso,
      });
      setGastoRegistro({ desc: '', monto: '' });
      setReceptorEgreso({ nombre: '', apellido: '', rut: '' });
      setFirmaEgreso(null);
      setModalEgreso(false);
      await cargarEgresosTurno(turno?.id);
      showToast({ message: 'Egreso registrado correctamente.', type: 'success' });
    } catch (err) {
      showToast({ message: err.message || 'No se pudo registrar el egreso.', type: 'error' });
    } finally {
      setRegistrandoEgreso(false);
    }
  };

  const crearProducto = async () => {
    if (!nuevoProducto.nombre || !nuevoProducto.precio) { showToast({ message: 'Faltan datos', type: 'error' }); return; }
    try {
      await kioscoAPI.productos.create({
        nombre: nuevoProducto.nombre,
        emoji: nuevoProducto.emoji || '📦',
        categoria: nuevoProducto.categoria,
        costo: Number(nuevoProducto.costo) || 0,
        precio: Number(nuevoProducto.precio) || 0,
        stock: Number(nuevoProducto.stock) || 0,
        talla: nuevoProducto.talla || null,
      });
      setNuevoProducto({ nombre: '', emoji: '', costo: '', precio: '', categoria: 'Bebida', talla: '' });
      await cargarProductos();
      showToast({ message: 'Producto creado.', type: 'success' });
    } catch (err) {
      showToast({ message: err.message || 'No se pudo crear el producto.', type: 'error' });
    }
  };

  const actualizarStock = async (prod, nuevoStock) => {
    try {
      await kioscoAPI.productos.update(prod.id, { stock: Math.max(0, nuevoStock) });
      await cargarProductos();
    } catch (err) {
      showToast({ message: err.message || 'No se pudo actualizar el stock.', type: 'error' });
    }
  };

  const actualizarPrecio = async (prod, nuevoPrecio) => {
    try {
      await kioscoAPI.productos.update(prod.id, { precio: Math.max(0, nuevoPrecio) });
      await cargarProductos();
    } catch (err) {
      showToast({ message: err.message || 'No se pudo actualizar el precio.', type: 'error' });
    }
  };

  const actualizarCampoProducto = async (prod, campo, valor) => {
    try {
      await kioscoAPI.productos.update(prod.id, { [campo]: valor });
      await cargarProductos();
    } catch (err) {
      showToast({ message: err.message || 'No se pudo actualizar el producto.', type: 'error' });
    }
  };

  const eliminarProducto = async (prod) => {
    if (!(await confirmAction({ title: 'Eliminar producto', message: `¿Eliminar "${prod.nombre}" del catálogo? Ya no aparecerá para vender, pero las ventas ya registradas se conservan.`, danger: true, confirmText: 'Eliminar' }))) {
      return;
    }
    try {
      await kioscoAPI.productos.remove(prod.id);
      setCarrito((prev) => prev.filter((i) => i.id !== prod.id));
      await cargarProductos();
      showToast({ message: 'Producto eliminado del catálogo.', type: 'success' });
    } catch (err) {
      showToast({ message: err.message || 'No se pudo eliminar el producto.', type: 'error' });
    }
  };

  const borrarHistorialVentas = async () => {
    if (!(await confirmAction({ title: 'Borrar historial de ventas', message: 'Esto elimina permanentemente todas las ventas registradas (afecta la analítica y los rankings). Los turnos cerrados y sus totales no se ven afectados. ¿Continuar?', danger: true, confirmText: 'Borrar todo' }))) {
      return;
    }
    try {
      await kioscoAPI.ventas.resetAll();
      setVentasAnalitica([]);
      showToast({ message: 'Historial de ventas borrado.', type: 'success' });
    } catch (err) {
      showToast({ message: err.message || 'No se pudo borrar el historial.', type: 'error' });
    }
  };

  // Recibe todos los datos explicitos (no lee estado en vivo) para poder generar
  // tanto el PDF del cierre recien hecho como el de un turno pasado del historial.
  const exportarCajaPdf = async (datos) => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginX = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const colorMarino = [11, 29, 58];
    const colorVerde = [52, 199, 89];
    const colorRojo = [255, 59, 48];
    const colorNaranja = [255, 149, 0];
    const colorGrisTexto = [90, 98, 110];
    const colorGrisClaro = [242, 244, 247];

    let y = 100;
    const lineGap = 16;

    const salto = (extra = 0) => {
      if (y > 770 - extra) { doc.addPage(); dibujarEncabezado(); y = 100; }
    };

    const dibujarEncabezado = () => {
      doc.setFillColor(...colorMarino);
      doc.rect(0, 0, pageWidth, 70, 'F');
      if (logoDataUrl) {
        try { doc.addImage(logoDataUrl, 'PNG', marginX, 12, 46, 46); } catch { /* logo no disponible, se omite */ }
      }
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('CENTRO DE CULTURA FÍSICA', marginX + (logoDataUrl ? 58 : 0), 32);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Reporte de cierre de caja · Kiosco', marginX + (logoDataUrl ? 58 : 0), 48);
      doc.setTextColor(0, 0, 0);
    };

    const filaResumen = (label, valor, color = null, negrita = false) => {
      salto();
      doc.setFont('helvetica', negrita ? 'bold' : 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...colorGrisTexto);
      doc.text(label, marginX, y);
      doc.setTextColor(...(color || [20, 24, 32]));
      doc.text(String(valor), pageWidth - marginX, y, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y += lineGap;
    };

    const tituloSeccion = (texto) => {
      y += 10; salto(20);
      doc.setFillColor(...colorGrisClaro);
      doc.rect(marginX, y - 12, pageWidth - marginX * 2, 20, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...colorMarino);
      doc.text(texto, marginX + 6, y + 2);
      doc.setTextColor(0, 0, 0);
      y += 22;
    };

    const logoDataUrl = await cargarLogoClubDataUrl();
    dibujarEncabezado();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Cierre del ${datos.dia ? String(datos.dia).slice(0, 10) : hoyISO()}`, marginX, y);
    y += lineGap + 4;

    doc.setFontSize(10);
    filaResumen('Responsable de apertura', datos.responsable || 'N/D');
    filaResumen('Cerrado por', datos.cerradoPor || 'N/D');
    filaResumen('Ticket final', `#${(datos.ticketFinal || 0).toString().padStart(3, '0')}`);

    tituloSeccion('Resumen financiero');
    filaResumen('Apertura de caja', `$${Number(datos.montoInicial || 0).toLocaleString('es-CL')}`);
    filaResumen('Kiosco · Efectivo', `$${Number(datos.cajaEfectivoKiosco || 0).toLocaleString('es-CL')}`);
    filaResumen('Kiosco · Transferencia', `$${Number(datos.cajaTransferKiosco || 0).toLocaleString('es-CL')}`);
    filaResumen('Entradas · Efectivo', `$${Number(datos.cajaEfectivoEntradas || 0).toLocaleString('es-CL')}`);
    filaResumen('Entradas · Transferencia', `$${Number(datos.cajaTransferEntradas || 0).toLocaleString('es-CL')}`);
    filaResumen('Total egresos', `-$${Number(datos.totalEgresos || 0).toLocaleString('es-CL')}`, colorRojo);
    filaResumen('Pendientes (fiados)', `$${Number(datos.totalPendientes || 0).toLocaleString('es-CL')}`, colorNaranja);
    filaResumen('Caja neta final (efectivo)', `$${Number(datos.cajaNetaFinal || 0).toLocaleString('es-CL')}`, colorVerde, true);

    const egresosDetalle = datos.egresosDetalle || [];
    if (egresosDetalle.length > 0) {
      tituloSeccion('Detalle de egresos');
      doc.setFontSize(10);
      egresosDetalle.forEach((eg) => {
        salto();
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(20, 24, 32);
        doc.text(`• ${eg.descripcion}`, marginX + 4, y);
        doc.setTextColor(...colorRojo);
        doc.text(`-$${Number(eg.monto || 0).toLocaleString('es-CL')}`, pageWidth - marginX, y, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        y += lineGap;
        if (eg.nombre_receptor || eg.rut_receptor) {
          salto();
          doc.setFontSize(8);
          doc.setTextColor(...colorGrisTexto);
          doc.text(`   Recibe: ${eg.nombre_receptor || ''} ${eg.apellido_receptor || ''} · RUT ${eg.rut_receptor || 'N/D'}`, marginX + 4, y);
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(10);
          y += lineGap - 4;
        }
      });
    }

    const fiadosDetalle = datos.fiadosDetalle || [];
    if (fiadosDetalle.length > 0) {
      tituloSeccion('Cuentas pendientes (fiados) al cierre');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      fiadosDetalle.forEach((f) => {
        salto();
        doc.text(`• ${f.nombre}`, marginX + 4, y);
        doc.setTextColor(...colorNaranja);
        doc.text(`$${Number(f.monto_total || 0).toLocaleString('es-CL')}`, pageWidth - marginX, y, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        y += lineGap;
      });
    }

    const ranking = (() => {
      const acumulado = new Map();
      (datos.ventasParaRanking || []).forEach((v) => {
        const prev = acumulado.get(v.producto_nombre) || { nombre: v.producto_nombre, cantidad: 0 };
        prev.cantidad += Number(v.cantidad || 0);
        acumulado.set(v.producto_nombre, prev);
      });
      return Array.from(acumulado.values()).sort((a, b) => b.cantidad - a.cantidad);
    })();

    if (ranking.length > 0) {
      tituloSeccion('Ranking de ventas del turno');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      ranking.forEach((r, i) => {
        salto();
        doc.text(`${i + 1}. ${r.nombre}`, marginX + 4, y);
        doc.text(`${r.cantidad} ud.`, pageWidth - marginX, y, { align: 'right' });
        y += lineGap;
      });
    }

    if (datos.firma) {
      tituloSeccion('Firma de cierre');
      salto(70);
      try { doc.addImage(datos.firma, 'PNG', marginX, y, 160, 60); } catch { /* firma corrupta, se omite */ }
      y += 70;
    }

    const totalPaginas = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPaginas; p += 1) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(...colorGrisTexto);
      doc.text(`Centro de Cultura Física · Página ${p} de ${totalPaginas}`, pageWidth / 2, 820, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    }

    doc.save(`reporte-caja-${datos.dia ? String(datos.dia).slice(0, 10) : hoyISO()}.pdf`);
  };

  const abrirModalCierre = () => {
    setNombreCierre(nombreResponsable || turno?.responsable || '');
    setFirmaCierre(null);
    setModalCierre(true);
  };

  const confirmarCierre = async () => {
    if (!nombreCierre.trim()) {
      showToast({ message: 'Indica quién realiza el cierre.', type: 'error' });
      return;
    }
    if (!firmaCierre) {
      showToast({ message: 'Se requiere la firma para cerrar el turno.', type: 'error' });
      return;
    }
    setCerrandoTurno(true);
    try {
      const ventasDelTurno = await kioscoAPI.ventas.getAll({ turno_id: turno.id });
      const ticketFinal = ticketActual - 1;

      await kioscoAPI.turnos.cerrar(turno.id, {
        total_efectivo_ventas: cajaEfectivoKiosco + cajaEfectivoEntradas,
        total_transferencia_ventas: cajaTransferKiosco + cajaTransferEntradas,
        total_egresos: totalGastos,
        total_pendientes: totalPendientes,
        caja_neta_final: cajaNetaFinal,
        firma_base64: firmaCierre,
        cerrado_por: nombreCierre.trim(),
        ticket_final: ticketFinal,
      });

      await exportarCajaPdf({
        dia: turno.dia,
        responsable: turno.responsable,
        montoInicial: turno.monto_inicial,
        cerradoPor: nombreCierre.trim(),
        firma: firmaCierre,
        ticketFinal,
        cajaEfectivoKiosco,
        cajaTransferKiosco,
        cajaEfectivoEntradas,
        cajaTransferEntradas,
        totalEgresos: totalGastos,
        cajaNetaFinal,
        totalPendientes,
        egresosDetalle: egresos,
        fiadosDetalle: fiados,
        ventasParaRanking: ventasDelTurno,
      });

      setModalCierre(false);
      setTurno(null);
      setCajaEfectivoKiosco(0);
      setCajaTransferKiosco(0);
      setCajaEfectivoEntradas(0);
      setCajaTransferEntradas(0);
      setEgresos([]);
      setCarrito([]);
      showToast({ message: 'Turno cerrado y guardado en el historial.', type: 'success' });
    } catch (err) {
      showToast({ message: err.message || 'No se pudo cerrar el turno.', type: 'error' });
    } finally {
      setCerrandoTurno(false);
    }
  };

  const fiadosFiltrados = fiadoBusqueda.trim()
    ? fiados.filter((f) => f.nombre.toLowerCase().includes(fiadoBusqueda.trim().toLowerCase()))
    : fiados;

  if (cargando) {
    return <div className="fade-in text-center" style={{ padding: '60px 20px' }}><p className="text-muted">Cargando kiosco...</p></div>;
  }

  return (
    <div className="kiosco-container fade-in kiosco-shell">
      {turno ? (
        <div className="staff-header-info mb-15 kiosco-header-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.96) 100%)', padding: '16px 18px', borderRadius: '24px', boxShadow: '0 12px 28px rgba(15,23,42,0.06)', border: '1px solid rgba(255,255,255,0.72)' }}>
          <div><h4 style={{ margin: '0 0 5px 0', color: 'var(--texto-heading)', fontSize: '15px' }}>Caja Activa: {String(turno.dia).slice(0, 10)}</h4><span style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}><User size={12} /> {turno.responsable} | <Ticket size={12} /> Ticket: #{ticketActual.toString().padStart(3, '0')}</span></div>
          <button className="btn-pill btn-danger" onClick={abrirModalCierre}>Cerrar Turno</button>
        </div>
      ) : (
        <div className="staff-header-info mb-15 kiosco-header-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.96) 100%)', padding: '16px 18px', borderRadius: '24px', boxShadow: '0 12px 28px rgba(15,23,42,0.06)', border: '1px solid rgba(255,255,255,0.72)' }}>
          <div><h4 style={{ margin: '0 0 5px 0', color: 'var(--texto-heading)', fontSize: '15px' }}>Kiosco POS</h4><span style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Lock size={12} /> Caja sin abrir</span></div>
          <button className="btn-pill" style={{ background: '#FF9500', color: 'white' }} onClick={() => setVista('caja')}>Abrir Caja</button>
        </div>
      )}

      {modalPago === 'efectivo' && (
        <div className="modal-overlay-alert"><div className="modal-alert-card text-center" style={{ borderRadius: '24px' }}><h3 style={{ fontWeight: '900' }}>Cobro Efectivo</h3><p>Total: <strong style={{ fontSize: '22px' }}>${totalCarrito.toLocaleString('es-CL')}</strong></p><div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }} className="mb-15"><button className="btn-secondary" style={{ padding: '10px', fontSize: '13px', borderRadius: '14px' }} onClick={() => setMontoRecibido(totalCarrito)}>Exacto</button><button className="btn-secondary" style={{ padding: '10px', fontSize: '13px', borderRadius: '14px' }} onClick={() => setMontoRecibido(5000)}>$5.000</button><button className="btn-secondary" style={{ padding: '10px', fontSize: '13px', borderRadius: '14px' }} onClick={() => setMontoRecibido(10000)}>$10.000</button><button className="btn-secondary" style={{ padding: '10px', fontSize: '13px', borderRadius: '14px' }} onClick={() => setMontoRecibido(20000)}>$20.000</button></div><input type="number" className="form-input" placeholder="¿Con cuánto paga?" value={montoRecibido} onChange={(e) => setMontoRecibido(e.target.value)} />{Number(montoRecibido) >= totalCarrito && (<div className="vuelto-display">VUELTO: ${(Number(montoRecibido) - totalCarrito).toLocaleString('es-CL')}</div>)}<div className="modal-alert-buttons mt-20"><button className="btn-modal-cancelar" onClick={() => setModalPago(null)}>Atrás</button><button className="btn-modal-confirmar" style={{ background: 'linear-gradient(180deg, #34C759 0%, #28A745 100%)' }} onClick={() => { if (Number(montoRecibido) < totalCarrito) { showToast({ message: 'Falta dinero.', type: 'error' }); return; } finalizarDespachoPOS('efectivo'); }}>Cobrar</button></div></div></div>
      )}
      {modalPago === 'transferencia' && (
        <div className="modal-overlay-alert"><div className="modal-alert-card text-center" style={{ borderRadius: '24px' }}><ShieldAlert size={40} color="var(--gris-secundario)" strokeWidth={1.5} style={{ margin: '0 auto 10px auto' }} /><h3 style={{ fontWeight: '900' }}>Validar Transferencia</h3><div className="modal-alert-buttons mt-20"><button className="btn-modal-cancelar" onClick={() => setModalPago(null)}>Cancelar</button><button className="btn-modal-confirmar" style={{ background: 'linear-gradient(180deg, #2f8cff 0%, var(--azul-electrico) 100%)' }} onClick={() => finalizarDespachoPOS('transferencia')}>Verificado</button></div></div></div>
      )}
      {modalPago === 'fiado' && (
        <div className="modal-overlay-alert">
          <div className="modal-alert-card">
            <h3 className="text-center">Dejar Pendiente</h3>
            <div className="segment-control mb-15">
              <button type="button" className={`segment-btn ${fiadoModo === 'nueva' ? 'active' : ''}`} onClick={() => { setFiadoModo('nueva'); setFiadoSeleccionadoId(null); }}><PlusCircle size={14} /> Nueva cuenta</button>
              <button type="button" className={`segment-btn ${fiadoModo === 'existente' ? 'active' : ''}`} onClick={() => setFiadoModo('existente')}><Search size={14} /> Cuenta existente</button>
            </div>
            <form onSubmit={registrarCuentaPendiente}>
              {fiadoModo === 'nueva' ? (
                <input type="text" className="form-input mb-10" required placeholder="Nombre del responsable" value={nombreFiado} onChange={(e) => setNombreFiado(e.target.value)} />
              ) : (
                <div className="mb-10">
                  <input type="text" className="form-input mb-10" placeholder="Buscar por nombre..." value={fiadoBusqueda} onChange={(e) => setFiadoBusqueda(e.target.value)} />
                  <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--borde-suave)', borderRadius: '14px' }}>
                    {fiadosFiltrados.length === 0 && <p className="text-muted text-center" style={{ padding: '14px', margin: 0, fontSize: '13px' }}>Sin cuentas pendientes que coincidan.</p>}
                    {fiadosFiltrados.map((f) => (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => setFiadoSeleccionadoId(f.id)}
                        style={{ display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', borderBottom: '1px solid var(--borde-suave)', fontFamily: 'inherit', cursor: 'pointer', background: fiadoSeleccionadoId === f.id ? 'rgba(0,122,255,0.1)' : 'transparent' }}
                      >
                        <span style={{ fontWeight: '700' }}>{f.nombre}</span>
                        <span style={{ fontWeight: '900', color: '#FF9500' }}>${Number(f.monto_total).toLocaleString('es-CL')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <input type="text" className="form-input mb-15" placeholder="Descripción adicional (opcional)" value={detalleFiado} onChange={(e) => setDetalleFiado(e.target.value)} />
              <p className="text-center mb-10" style={{ fontSize: '13px', color: 'var(--texto-secundario)' }}>Se sumará <strong>${totalCarrito.toLocaleString('es-CL')}</strong>{fiadoModo === 'existente' && fiadoSeleccionadoId ? ' a la cuenta seleccionada.' : ' a una cuenta nueva.'}</p>
              <div className="modal-alert-buttons"><button type="button" className="btn-modal-cancelar" onClick={() => setModalPago(null)}>Cancelar</button><button type="submit" className="btn-modal-confirmar" style={{ background: '#FF9500' }}>Anotar Deuda</button></div>
            </form>
          </div>
        </div>
      )}

      {modalCierre && (
        <div className="modal-overlay-alert">
          <div className="modal-alert-card" style={{ maxWidth: '440px' }}>
            <h3 className="text-center" style={{ marginBottom: '4px' }}>Verificación de Cierre</h3>
            <p className="text-center text-muted" style={{ fontSize: '12px', marginBottom: '15px' }}>Revisa los totales antes de cerrar el turno.</p>

            <div className="desglose-row"><span>Total efectivo</span><strong style={{ color: 'var(--verde-victoria)' }}>${(cajaEfectivoKiosco + cajaEfectivoEntradas).toLocaleString('es-CL')}</strong></div>
            <div className="desglose-row"><span>Total transferencia</span><strong>${(cajaTransferKiosco + cajaTransferEntradas).toLocaleString('es-CL')}</strong></div>
            <div className="desglose-row"><span>Total egresos</span><strong style={{ color: 'var(--rojo-alerta)' }}>-${totalGastos.toLocaleString('es-CL')}</strong></div>
            <div className="desglose-row total-calc"><span>Caja neta final</span><strong>${cajaNetaFinal.toLocaleString('es-CL')}</strong></div>

            {totalPendientes > 0 && (
              <div className="card mt-10" style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.3)', padding: '10px 14px', borderRadius: '14px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', color: '#b36200', fontSize: '13px' }}><AlertTriangle size={14} /> Quedan ${totalPendientes.toLocaleString('es-CL')} en cuentas pendientes sin cobrar.</span>
              </div>
            )}

            <div className="input-group mt-15 mb-10">
              <label style={{ fontSize: '12px', fontWeight: '800' }}>¿Quién cierra el turno?</label>
              <input type="text" className="form-input" value={nombreCierre} onChange={(e) => setNombreCierre(e.target.value)} placeholder="Nombre de quien cierra" />
            </div>

            <div className="input-group mb-10">
              <label style={{ fontSize: '12px', fontWeight: '800' }}>Firma</label>
              <SignaturePad onChange={setFirmaCierre} />
            </div>

            <div className="modal-alert-buttons mt-10">
              <button type="button" className="btn-modal-cancelar" onClick={() => setModalCierre(false)} disabled={cerrandoTurno}>Cancelar</button>
              <button type="button" className="btn-modal-confirmar" style={{ background: 'var(--rojo-alerta)' }} onClick={confirmarCierre} disabled={cerrandoTurno}>{cerrandoTurno ? 'Cerrando...' : 'Confirmar Cierre'}</button>
            </div>
          </div>
        </div>
      )}

      {modalEgreso && (
        <div className="modal-overlay-alert">
          <div className="modal-alert-card" style={{ maxWidth: '440px' }}>
            <h3 className="text-center" style={{ marginBottom: '4px' }}>Registrar Egreso</h3>
            <p className="text-center text-muted" style={{ fontSize: '12px', marginBottom: '15px' }}>
              {gastoRegistro.desc} · ${Number(gastoRegistro.monto || 0).toLocaleString('es-CL')}
            </p>
            <p className="text-center" style={{ fontSize: '12px', marginBottom: '10px', color: 'var(--texto-secundario)' }}>
              Para dejar registro, indica quién recibe este dinero.
            </p>

            <div className="input-group mb-10">
              <label style={{ fontSize: '12px', fontWeight: '800' }}>Nombre</label>
              <input type="text" className="form-input" value={receptorEgreso.nombre} onChange={(e) => setReceptorEgreso({ ...receptorEgreso, nombre: e.target.value })} placeholder="Nombre" />
            </div>
            <div className="input-group mb-10">
              <label style={{ fontSize: '12px', fontWeight: '800' }}>Apellido</label>
              <input type="text" className="form-input" value={receptorEgreso.apellido} onChange={(e) => setReceptorEgreso({ ...receptorEgreso, apellido: e.target.value })} placeholder="Apellido" />
            </div>
            <div className="input-group mb-10">
              <label style={{ fontSize: '12px', fontWeight: '800' }}>RUT</label>
              <input type="text" className="form-input" value={receptorEgreso.rut} onChange={(e) => setReceptorEgreso({ ...receptorEgreso, rut: e.target.value })} placeholder="12345678-9" />
            </div>
            <div className="input-group mb-10">
              <label style={{ fontSize: '12px', fontWeight: '800' }}>Firma</label>
              <SignaturePad onChange={setFirmaEgreso} />
            </div>

            <div className="modal-alert-buttons mt-10">
              <button type="button" className="btn-modal-cancelar" onClick={() => setModalEgreso(false)} disabled={registrandoEgreso}>Cancelar</button>
              <button type="button" className="btn-modal-confirmar" style={{ background: 'var(--rojo-alerta)' }} onClick={registrarEgreso} disabled={registrandoEgreso}>{registrandoEgreso ? 'Guardando...' : 'Confirmar Egreso'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="scroll-horizontal-menu mb-15">
        <div className="segment-control">
          <button type="button" className={`segment-btn ${vista === 'pos' ? 'active' : ''}`} onClick={() => setVista('pos')}>Vender</button>
          <button type="button" className={`segment-btn ${vista === 'caja' ? 'active' : ''}`} onClick={() => setVista('caja')}>Caja</button>
          <button type="button" className={`segment-btn ${vista === 'inventario' ? 'active' : ''}`} onClick={() => setVista('inventario')}>Inventario</button>
          <button type="button" className={`segment-btn ${vista === 'analitica' ? 'active' : ''}`} onClick={() => setVista('analitica')}>Analítica</button>
          <button type="button" className={`segment-btn ${vista === 'fiados' ? 'active' : ''}`} onClick={() => setVista('fiados')}>Pendientes</button>
          <button type="button" className={`segment-btn ${vista === 'historial' ? 'active' : ''}`} onClick={() => setVista('historial')}><History size={14} /> Historial</button>
        </div>
      </div>

      {vista === 'pos' && (
        <div className="kiosco-tablet-layout">
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginBottom: '8px' }}>
            <button
              type="button"
              className="btn-circle"
              title="Vista en grilla"
              style={{ background: vistaProductos === 'grid' ? 'var(--azul-electrico)' : 'rgba(0,122,255,0.12)', color: vistaProductos === 'grid' ? 'white' : 'var(--azul-electrico)' }}
              onClick={() => setVistaProductos('grid')}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              className="btn-circle"
              title="Vista en lista"
              style={{ background: vistaProductos === 'list' ? 'var(--azul-electrico)' : 'rgba(0,122,255,0.12)', color: vistaProductos === 'list' ? 'white' : 'var(--azul-electrico)' }}
              onClick={() => setVistaProductos('list')}
            >
              <List size={14} />
            </button>
          </div>
          <div className={`kiosco-grid ${vistaProductos === 'list' ? 'modo-lista' : ''}`}>
            {productos.map((prod) => {
              const stock = Number(prod.stock);
              const isCritico = stock > 0 && stock <= 5;
              const sinStock = stock <= 0;
              const colorCat = getColorPorCategoria(prod.categoria);
              return (
                <button
                  type="button"
                  key={prod.id}
                  className={`kiosco-item ${sinStock ? 'producto-agotado-card' : ''}`}
                  style={{ background: colorCat.bg, borderColor: colorCat.border, opacity: sinStock ? 0.55 : 1, cursor: sinStock ? 'not-allowed' : 'pointer' }}
                  onClick={() => agregarAlCarrito(prod)}
                >
                  <div id={`prod-${prod.id}`} className="kiosco-item-inner" style={{ transition: '0.1s' }}>
                    <span className="kiosco-emoji">{prod.emoji}</span>
                    <span className="kiosco-nombre" style={{ color: colorCat.text }}>{prod.nombre}{prod.talla ? ` (${prod.talla})` : ''}</span>
                    <span className="kiosco-stock-label" style={{ color: isCritico || sinStock ? 'var(--rojo-alerta)' : colorCat.text }}>Stock: {stock}</span>
                    <span className="kiosco-precio" style={{ color: colorCat.text }}>${Number(prod.precio).toLocaleString('es-CL')}</span>
                  </div>
                  {sinStock && <span className="badge-agotado-tag">SIN STOCK</span>}
                  {isCritico && !sinStock && <span className="badge-critico-tag" style={{ position: 'absolute', top: 5, left: 5, background: '#FF9500', color: 'white', fontSize: '8px', padding: '2px 4px', borderRadius: '999px' }}>CRÍTICO</span>}
                </button>
              );
            })}
            {productos.length === 0 && <p className="text-muted text-center" style={{ gridColumn: '1 / -1' }}>Sin productos en el catálogo. Agrégalos en Inventario.</p>}
          </div>

          <div className="card kiosco-cart mt-20">
            <div className="cart-header-row">
              <h4 className="form-subtitle" style={{ margin: 0 }}>Ticket #{ticketActual.toString().padStart(3, '0')}</h4>
              {carrito.length > 0 && (
                <button className="btn-borrar-carrito" onClick={async () => { if (await confirmAction({ title: 'Borrar carrito', message: '¿Borrar el contenido del carrito? El número de ticket se mantiene.', danger: true })) { setCarrito([]); } }}>
                  <Trash2 size={13} /> Borrar Contenido
                </button>
              )}
            </div>
            {carrito.length === 0 && <p className="text-center text-muted" style={{ fontStyle: 'italic', margin: '20px 0' }}>Carrito vacío.</p>}
            {carrito.length > 0 && (
              <>
                <div className="cart-items-list-scroll">
                  <div className="cart-items-list">
                    {carrito.map((item) => (
                      <div key={item.id} className="cart-item-row">
                        <div className="cart-item-info"><span className="cart-item-cant">{item.cant}x</span><span className="cart-item-name">{item.nombre}</span></div>
                        <div className="cart-item-actions"><span className="cart-item-subtotal">${(item.precio * item.cant).toLocaleString('es-CL')}</span><button className="cart-btn-restar" onClick={() => { if (item.cant === 1) setCarrito(carrito.filter((i) => i.id !== item.id)); else setCarrito(carrito.map((i) => (i.id === item.id ? { ...i, cant: i.cant - 1 } : i))); }}>-</button></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="cart-total-row mt-15"><span>TOTAL A PAGAR</span><h2>${totalCarrito.toLocaleString('es-CL')}</h2></div>
                <div className="cart-pay-buttons mt-15">
                  <button className="btn-pago efectivo" onClick={() => abrirModalPago('efectivo')}><Banknote size={16} /> Efectivo</button>
                  <button className="btn-pago transferencia" onClick={() => abrirModalPago('transferencia')}><Smartphone size={16} /> Transfer</button>
                  <button className="btn-pago" style={{ background: '#FF9500' }} onClick={() => abrirModalPago('fiado')}><NotebookPen size={16} /> Fiado</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {vista === 'caja' && !turno && (
        <div className="fade-in">
          <div className="card mb-15" style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.3)', borderRadius: '18px' }}>
            <span style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontWeight: '800', color: '#b36200', fontSize: '13px' }}><AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} /> Para ocupar la caja debes abrirla primero con nombre de responsable, fecha y monto inicial.</span>
          </div>
          <div className="card" style={{ textAlign: 'left', borderRadius: '24px' }}>
            <div className="input-group mb-10"><label style={{ fontSize: '12px', fontWeight: '800' }}>Responsable de Turno</label><input type="text" className="form-input" value={formApertura.responsable} onChange={(e) => setFormApertura({ ...formApertura, responsable: e.target.value })} placeholder="Ej: María Tesorera" /></div>
            <div className="input-group mb-10"><label style={{ fontSize: '12px', fontWeight: '800' }}>Fecha de Caja</label><input type="date" className="form-input" value={formApertura.dia} onChange={(e) => setFormApertura({ ...formApertura, dia: e.target.value })} /></div>
            <div className="input-group mb-15"><label style={{ fontSize: '12px', fontWeight: '800' }}>Sencillo Inicial (CLP)</label><input type="number" className="form-input" value={formApertura.montoInicial} onChange={(e) => setFormApertura({ ...formApertura, montoInicial: e.target.value })} placeholder="Ej: 20000" /></div>
            <button className="btn-electric" disabled={!formApertura.responsable || !formApertura.dia || !formApertura.montoInicial} onClick={abrirTurno}>ABRIR CAJA</button>
          </div>
        </div>
      )}

      {vista === 'caja' && turno && (
        <div className="fade-in">
          <div className="checkout-total-box"><span style={{ color: 'rgba(255,255,255,0.7)' }}>Efectivo Físico Neto en Caja</span><h2 style={{ color: 'white', textShadow: 'none' }}>${cajaNetaFinal.toLocaleString('es-CL')}</h2><span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '8px' }}>Apertura: ${Number(turno.monto_inicial).toLocaleString('es-CL')}</span></div>
          <div className="caja-doble-grid mt-15">
            <div className="card sub-caja-card"><h5 className="sub-caja-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><BookOpen size={14} /> Kiosco</h5><div className="desglose-row"><span>Efec:</span><strong style={{ color: 'var(--verde-victoria)' }}>+${cajaEfectivoKiosco.toLocaleString('es-CL')}</strong></div><div className="desglose-row"><span>Trans:</span><strong>+${cajaTransferKiosco.toLocaleString('es-CL')}</strong></div></div>
            <div className="card sub-caja-card"><h5 className="sub-caja-title" style={{ color: 'var(--azul-electrico)', display: 'flex', alignItems: 'center', gap: '6px' }}><Ticket size={14} /> Entradas</h5><div className="desglose-row"><span>Efec:</span><strong style={{ color: 'var(--verde-victoria)' }}>+${cajaEfectivoEntradas.toLocaleString('es-CL')}</strong></div><div className="desglose-row"><span>Trans:</span><strong>+${cajaTransferEntradas.toLocaleString('es-CL')}</strong></div></div>
          </div>
          <div className="card mt-15">
            <h4 className="form-subtitle" style={{ color: 'var(--rojo-alerta)' }}><Wallet size={16} color="var(--gris-secundario)" strokeWidth={1.5} /> Registrar Egreso (Salida)</h4>
            <div style={{ display: 'flex', gap: '10px' }} className="mt-10"><input type="text" className="form-input" style={{ flex: 2 }} placeholder="Glosa (Ej: Árbitros)" value={gastoRegistro.desc} onChange={(e) => setGastoRegistro({ ...gastoRegistro, desc: e.target.value })} /><input type="number" className="form-input" style={{ flex: 1 }} placeholder="Monto" value={gastoRegistro.monto} onChange={(e) => setGastoRegistro({ ...gastoRegistro, monto: e.target.value })} /><button className="btn-electric" style={{ background: 'var(--rojo-alerta)', width: 'auto', padding: '0 15px' }} onClick={abrirModalEgreso}>Restar</button></div>
            {egresos.length > 0 && (<div className="egresos-list mt-15"><span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)' }}>Egresos de Hoy</span>{egresos.map((eg) => (<div key={eg.id} className="egreso-row mt-5"><span className="egreso-desc" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><XCircle size={12} /> {eg.descripcion}</span>{(eg.nombre_receptor || eg.rut_receptor) && (<span style={{ fontSize: '10px', color: 'var(--texto-secundario)', fontWeight: '700' }}>Recibe: {eg.nombre_receptor} {eg.apellido_receptor} {eg.rut_receptor ? `· ${eg.rut_receptor}` : ''}</span>)}</span><span className="egreso-monto">-${Number(eg.monto).toLocaleString('es-CL')}</span></div>))}</div>)}
          </div>
          <button
            className="btn-secondary mt-15"
            style={{ background: 'rgba(0,122,255,0.1)' }}
            onClick={() => exportarCajaPdf({
              dia: turno.dia,
              responsable: turno.responsable,
              montoInicial: turno.monto_inicial,
              cerradoPor: turno.responsable,
              firma: null,
              ticketFinal: ticketActual - 1,
              cajaEfectivoKiosco,
              cajaTransferKiosco,
              cajaEfectivoEntradas,
              cajaTransferEntradas,
              totalEgresos: totalGastos,
              cajaNetaFinal,
              totalPendientes,
              egresosDetalle: egresos,
              fiadosDetalle: fiados,
              ventasParaRanking: [],
            })}
          ><FileDown size={18} color="var(--gris-secundario)" strokeWidth={1.5} /> Exportar Reporte Parcial (PDF)</button>
        </div>
      )}

      {vista === 'inventario' && (
        <div className="fade-in">
          <div className="card mb-15">
            <h4 className="form-subtitle">Crear Producto / Ingreso</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }} className="mb-10">
              <input type="text" className="form-input" placeholder="Nombre" value={nuevoProducto.nombre} onChange={(e) => setNuevoProducto({ ...nuevoProducto, nombre: e.target.value })} />
              <input type="text" className="form-input" placeholder="Emoji (Ej: 🍫)" value={nuevoProducto.emoji} onChange={(e) => setNuevoProducto({ ...nuevoProducto, emoji: e.target.value })} />
              <input type="number" className="form-input" placeholder="Costo Compra ($)" value={nuevoProducto.costo} onChange={(e) => setNuevoProducto({ ...nuevoProducto, costo: e.target.value })} />
              <input type="number" className="form-input" placeholder="Precio Venta ($)" value={nuevoProducto.precio} onChange={(e) => setNuevoProducto({ ...nuevoProducto, precio: e.target.value })} />
              <input type="number" className="form-input" placeholder="Stock inicial" value={nuevoProducto.stock || ''} onChange={(e) => setNuevoProducto({ ...nuevoProducto, stock: e.target.value })} />
              <select className="form-input" value={nuevoProducto.categoria} onChange={(e) => setNuevoProducto({ ...nuevoProducto, categoria: e.target.value })}>
                <option value="Bebida">Bebida</option><option value="Comida">Comida</option><option value="Entradas">Entradas/Otros</option>
              </select>
              <select className="form-input" value={nuevoProducto.talla} onChange={(e) => setNuevoProducto({ ...nuevoProducto, talla: e.target.value })}>
                <option value="">Sin talla</option><option value="S">S</option><option value="M">M</option><option value="L">L</option>
              </select>
            </div>
            <button className="btn-electric" onClick={crearProducto}>Añadir al Catálogo</button>
          </div>
          <div className="card">
            <h4 className="form-subtitle">Stock Actual</h4>
            <div className="roster-list mt-10">
              {productos.map((prod) => {
                const editando = productoEditandoId === prod.id;
                return (
                  <div key={prod.id} className="roster-item" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      {editando ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '54px 1fr', gap: '6px', flex: 1 }}>
                          <input type="text" className="form-input" style={{ padding: '6px', textAlign: 'center', fontSize: '18px' }} value={prod.emoji} onChange={(e) => actualizarCampoProducto(prod, 'emoji', e.target.value)} />
                          <input type="text" className="form-input" style={{ padding: '6px', fontSize: '13px', fontWeight: '800' }} value={prod.nombre} onChange={(e) => actualizarCampoProducto(prod, 'nombre', e.target.value)} />
                          <select className="form-input" style={{ gridColumn: '1 / -1', padding: '6px', fontSize: '12px' }} value={prod.categoria} onChange={(e) => actualizarCampoProducto(prod, 'categoria', e.target.value)}>
                            <option value="Bebida">Bebida</option><option value="Comida">Comida</option><option value="Entradas">Entradas/Otros</option>
                          </select>
                          <select className="form-input" style={{ gridColumn: '1 / -1', padding: '6px', fontSize: '12px' }} value={prod.talla || ''} onChange={(e) => actualizarCampoProducto(prod, 'talla', e.target.value || null)}>
                            <option value="">Sin talla</option><option value="S">S</option><option value="M">M</option><option value="L">L</option>
                          </select>
                        </div>
                      ) : (
                        <div><span style={{ fontSize: '24px', marginRight: '10px' }}>{prod.emoji}</span><strong style={{ color: 'var(--texto-principal)' }}>{prod.nombre}</strong><br /><span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: 'bold' }}>Costo: ${prod.costo} | Venta: ${prod.precio} | {prod.categoria}{prod.talla && ` · Talla ${prod.talla}`}</span></div>
                      )}
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button type="button" className="btn-circle" style={{ background: editando ? 'var(--verde-victoria)' : 'rgba(0,122,255,0.12)', color: editando ? 'white' : 'var(--azul-electrico)' }} title={editando ? 'Listo' : 'Editar'} onClick={() => setProductoEditandoId(editando ? null : prod.id)}>
                          {editando ? <Check size={14} /> : <Pencil size={14} />}
                        </button>
                        <button type="button" className="btn-circle btn-danger" title="Eliminar" onClick={() => eliminarProducto(prod)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button className="btn-circle btn-danger" onClick={() => actualizarStock(prod, Number(prod.stock) - 1)}>-</button>
                        <input type="number" style={{ width: '50px', textAlign: 'center', padding: '4px 4px', border: '1.5px solid var(--borde-suave)', borderRadius: '999px', background: 'var(--fondo-input)', color: Number(prod.stock) <= 5 ? 'var(--rojo-alerta)' : 'var(--texto-principal)', fontWeight: '900', fontSize: '14px' }} value={prod.stock} onChange={(e) => actualizarStock(prod, parseInt(e.target.value, 10) || 0)} />
                        <button className="btn-circle btn-success" onClick={() => actualizarStock(prod, Number(prod.stock) + 1)}>+</button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--fondo-input)', padding: '4px 8px', borderRadius: '999px', border: '1.5px solid var(--borde-suave)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '800' }}>$</span>
                        <input type="number" style={{ width: '64px', border: 'none', background: 'transparent', color: 'var(--texto-principal)', fontWeight: '900', fontSize: '13px', textAlign: 'center', outline: 'none' }} value={prod.precio} onChange={(e) => actualizarPrecio(prod, parseInt(e.target.value, 10) || 0)} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {productos.length === 0 && <p className="text-muted text-center">Sin productos aún.</p>}
            </div>
          </div>
        </div>
      )}

      {vista === 'analitica' && (
        <div className="fade-in">
          <h3 className="section-title">Inteligencia de Negocio</h3>

          <div className="card mb-15">
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} className="mb-10">
              <button className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', fontSize: '12px' }} onClick={() => { setAnaliticaDesde(hoyISO()); setAnaliticaHasta(hoyISO()); }}>Hoy</button>
              <button className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', fontSize: '12px' }} onClick={() => { setAnaliticaDesde(inicioSemanaISO()); setAnaliticaHasta(hoyISO()); }}>Esta Semana</button>
              <button className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', fontSize: '12px' }} onClick={() => { setAnaliticaDesde(inicioMesISO()); setAnaliticaHasta(hoyISO()); }}>Este Mes</button>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="date" className="form-input" value={analiticaDesde} onChange={(e) => setAnaliticaDesde(e.target.value)} />
              <input type="date" className="form-input" value={analiticaHasta} onChange={(e) => setAnaliticaHasta(e.target.value)} />
            </div>
          </div>

          <div className="checkout-total-box mb-15">
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>Recaudación en el período</span>
            <h2 style={{ color: 'white', textShadow: 'none' }}>${totalRecaudadoAnalitica.toLocaleString('es-CL')}</h2>
          </div>

          {cargandoAnalitica && <p className="text-muted text-center">Cargando...</p>}

          {!cargandoAnalitica && (
            <>
              <div className="card" style={{ borderLeft: '4px solid var(--verde-victoria)' }}>
                <h4 className="form-subtitle"><TrendingUp size={16} color="#10b981" strokeWidth={1.5} /> Más Vendidos</h4>
                {rankingVentas.slice(0, 5).map((p, i) => (
                  <div key={p.nombre} className="desglose-row mt-10" style={{ fontSize: '15px' }}><span>{i + 1}. {p.nombre}</span><strong style={{ color: 'var(--verde-victoria)' }}>{p.cantidad} ud.</strong></div>
                ))}
                {rankingVentas.length === 0 && <p className="text-muted" style={{ margin: '10px 0 0' }}>Sin ventas registradas en este período.</p>}
              </div>
              <div className="card mt-15" style={{ borderLeft: '4px solid var(--rojo-alerta)' }}>
                <h4 className="form-subtitle"><TrendingDown size={16} color="var(--rojo-alerta)" strokeWidth={1.5} /> Menos Movimiento</h4>
                {[...rankingVentas].reverse().slice(0, 3).map((p) => (
                  <div key={p.nombre} className="desglose-row mt-10" style={{ fontSize: '15px' }}><span>{p.nombre}</span><strong style={{ color: 'var(--rojo-alerta)' }}>{p.cantidad} ud.</strong></div>
                ))}
                {rankingVentas.length === 0 && <p className="text-muted" style={{ margin: '10px 0 0' }}>Sin datos aún.</p>}
              </div>
            </>
          )}

          <button className="btn-secondary mt-15" style={{ background: 'rgba(255,59,48,0.08)', color: 'var(--rojo-alerta)' }} onClick={borrarHistorialVentas}><Trash2 size={16} /> Borrar historial de ventas</button>
        </div>
      )}

      {vista === 'fiados' && (
        <div className="fade-in">
          <div className="checkout-total-box mb-15" style={{ background: 'linear-gradient(135deg, #FF9500, #E65100)', border: 'none', padding: '20px' }}><span style={{ color: 'rgba(255,255,255,0.8)' }}>Dinero en la calle</span><h2 style={{ color: 'white', textShadow: 'none', fontSize: '32px' }}>${totalPendientes.toLocaleString('es-CL')}</h2></div>
          {fiados.length === 0 ? <p className="text-center text-muted card" style={{ fontStyle: 'italic' }}>Sin deudas pendientes hoy.</p> : null}
          {fiados.map((f) => (
            <div key={f.id} className="card" style={{ borderLeft: '4px solid #FF9500', padding: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><h4 style={{ margin: 0, color: 'var(--texto-principal)' }}>{f.nombre}</h4><span style={{ fontWeight: '900', color: '#FF9500', fontSize: '16px' }}>${Number(f.monto_total).toLocaleString('es-CL')}</span></div>
              <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', margin: '8px 0' }}>{f.detalle}</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button className="btn-pill btn-success" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }} onClick={() => pagarFiado(f, 'efectivo')}><Banknote size={14} /> Efectivo</button>
                <button className="btn-pill" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }} onClick={() => pagarFiado(f, 'transferencia')}><Smartphone size={14} /> Transfer</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {vista === 'historial' && (
        <div className="fade-in">
          <h3 className="section-title"><BarChart3 size={18} /> Historial de Cierres</h3>

          <div className="card mb-15" style={{ padding: '12px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="input-group" style={{ flex: '1 1 140px' }}>
                <label style={{ fontSize: '11px', fontWeight: '800' }}>Desde</label>
                <input type="date" className="form-input mt-5" value={historialDesde} onChange={(e) => setHistorialDesde(e.target.value)} />
              </div>
              <div className="input-group" style={{ flex: '1 1 140px' }}>
                <label style={{ fontSize: '11px', fontWeight: '800' }}>Hasta</label>
                <input type="date" className="form-input mt-5" value={historialHasta} onChange={(e) => setHistorialHasta(e.target.value)} />
              </div>
              {(historialDesde || historialHasta) && (
                <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => { setHistorialDesde(''); setHistorialHasta(''); }}>Limpiar</button>
              )}
            </div>
          </div>

          {cargandoHistorial && <p className="text-muted text-center">Cargando...</p>}
          {!cargandoHistorial && historialTurnos.length === 0 && <p className="text-center text-muted card" style={{ fontStyle: 'italic' }}>No hay cierres para este rango.</p>}
          {!cargandoHistorial && historialTurnos.map((t) => (
            <div key={t.id} className="card mb-10" style={{ padding: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => alternarDetalleTurno(t)}>
                <div>
                  <strong style={{ color: 'var(--texto-principal)' }}>{String(t.dia).slice(0, 10)}</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--texto-secundario)' }}>Responsable: {t.responsable} · Cerrado por: {t.cerrado_por || 'N/D'}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: '900', color: 'var(--verde-victoria)', fontSize: '16px' }}>${Number(t.caja_neta_final).toLocaleString('es-CL')}</span>
                  {turnoDetalleId === t.id ? <ChevronUp size={18} color="var(--gris-secundario)" /> : <ChevronDown size={18} color="var(--gris-secundario)" />}
                </div>
              </div>
              <div className="caja-doble-grid mt-10" style={{ gap: '8px' }}>
                <div className="desglose-row"><span>Efectivo</span><strong>${Number(t.total_efectivo_ventas).toLocaleString('es-CL')}</strong></div>
                <div className="desglose-row"><span>Transferencia</span><strong>${Number(t.total_transferencia_ventas).toLocaleString('es-CL')}</strong></div>
                <div className="desglose-row"><span>Egresos</span><strong style={{ color: 'var(--rojo-alerta)' }}>-${Number(t.total_egresos).toLocaleString('es-CL')}</strong></div>
                <div className="desglose-row"><span>Pendientes al cierre</span><strong style={{ color: '#FF9500' }}>${Number(t.total_pendientes).toLocaleString('es-CL')}</strong></div>
              </div>

              {turnoDetalleId === t.id && (
                <div className="mt-15" style={{ borderTop: '1px dashed var(--borde-suave)', paddingTop: '12px' }}>
                  {cargandoDetalleTurno && <p className="text-muted text-center" style={{ fontSize: '12px' }}>Cargando detalle...</p>}
                  {!cargandoDetalleTurno && (
                    <>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)' }}>Egresos del turno ({detalleTurno.egresos.length})</span>
                      {detalleTurno.egresos.length === 0 && <p className="text-muted" style={{ fontSize: '12px', fontStyle: 'italic', margin: '4px 0 0' }}>Sin egresos registrados.</p>}
                      {detalleTurno.egresos.map((eg) => (
                        <div key={eg.id} className="egreso-row mt-5">
                          <span className="egreso-desc" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span>{eg.descripcion}</span>
                            {(eg.nombre_receptor || eg.rut_receptor) && (
                              <span style={{ fontSize: '10px', color: 'var(--texto-secundario)', fontWeight: '700' }}>Recibe: {eg.nombre_receptor} {eg.apellido_receptor} · {eg.rut_receptor}</span>
                            )}
                          </span>
                          <span className="egreso-monto">-${Number(eg.monto).toLocaleString('es-CL')}</span>
                        </div>
                      ))}

                      <span className="mt-15" style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)' }}>Ventas del turno ({detalleTurno.ventas.length})</span>
                      {detalleTurno.ventas.length === 0 && <p className="text-muted" style={{ fontSize: '12px', fontStyle: 'italic', margin: '4px 0 0' }}>Sin ventas registradas.</p>}
                    </>
                  )}

                  <div className="mt-15" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      className="btn-secondary"
                      style={{ width: 'auto', background: 'rgba(0,122,255,0.1)' }}
                      disabled={exportandoTurnoId === t.id}
                      onClick={() => exportarTurnoHistorial(t)}
                    >
                      <FileDown size={16} color="var(--gris-secundario)" strokeWidth={1.5} /> {exportandoTurnoId === t.id ? 'Exportando...' : 'Exportar PDF'}
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ width: 'auto', background: 'rgba(255,59,48,0.1)', color: 'var(--rojo-alerta)' }}
                      onClick={() => eliminarTurnoHistorial(t)}
                    >
                      <Trash2 size={16} /> Eliminar cierre
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default KioscoPanel;

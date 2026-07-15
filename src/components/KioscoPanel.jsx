import { useEffect, useMemo, useState } from 'react';
import { FileDown, ShieldAlert, Wallet, TrendingUp, TrendingDown, Lock, User, Ticket, Trash2, Banknote, Smartphone, NotebookPen, BookOpen, XCircle, Search, PlusCircle, History, AlertTriangle, BarChart3 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { getColorPorCategoria } from '../utils/appHelpers';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import { kioscoAPI } from '../api/client';
import SignaturePad from './SignaturePad';

const hoyISO = () => new Date().toISOString().slice(0, 10);

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

  const [nuevoProducto, setNuevoProducto] = useState({ nombre: '', emoji: '', costo: '', precio: '', categoria: 'Bebida' });

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
        const data = await kioscoAPI.turnos.getAll({ estado: 'cerrado' });
        setHistorialTurnos(data);
      } catch (err) {
        showToast({ message: err.message || 'No se pudo cargar el historial.', type: 'error' });
      } finally {
        setCargandoHistorial(false);
      }
    })();
  }, [vista]);

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
        producto_nombre: item.nombre,
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

  const registrarEgreso = async () => {
    if (!gastoRegistro.desc || !gastoRegistro.monto) return;
    try {
      await kioscoAPI.egresos.create({ turno_id: turno?.id || null, descripcion: gastoRegistro.desc, monto: Number(gastoRegistro.monto) });
      setGastoRegistro({ desc: '', monto: '' });
      await cargarEgresosTurno(turno?.id);
    } catch (err) {
      showToast({ message: err.message || 'No se pudo registrar el egreso.', type: 'error' });
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
      });
      setNuevoProducto({ nombre: '', emoji: '', costo: '', precio: '', categoria: 'Bebida' });
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

  const exportarCajaPdf = (ventasParaRanking, fiadosAlCierre, totalesCierre) => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginX = 40;
    let y = 50;
    const lineGap = 16;

    const salto = () => {
      if (y > 780) { doc.addPage(); y = 50; }
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('CENTRO DE CULTURA FISICA - REPORTE DE CIERRE DE CAJA', marginX, y);
    y += lineGap + 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const resumen = [
      `Fecha: ${turno?.dia ? String(turno.dia).slice(0, 10) : hoyISO()}`,
      `Responsable de apertura: ${turno?.responsable || 'N/D'}`,
      `Cerrado por: ${totalesCierre.cerradoPor || 'N/D'}`,
      `Ticket final: #${(totalesCierre.ticketFinal || 0).toString().padStart(3, '0')}`,
      '---',
      `Apertura: $${Number(turno?.monto_inicial || 0).toLocaleString('es-CL')}`,
      `Kiosco efectivo: $${Number(cajaEfectivoKiosco || 0).toLocaleString('es-CL')}`,
      `Kiosco transferencia: $${Number(cajaTransferKiosco || 0).toLocaleString('es-CL')}`,
      `Entradas efectivo: $${Number(cajaEfectivoEntradas || 0).toLocaleString('es-CL')}`,
      `Entradas transferencia: $${Number(cajaTransferEntradas || 0).toLocaleString('es-CL')}`,
      `Total egresos: $${Number(totalGastos || 0).toLocaleString('es-CL')}`,
      `Caja neta final (efectivo): $${Number(cajaNetaFinal || 0).toLocaleString('es-CL')}`,
      `Total pendientes (fiados abiertos): $${Number(fiadosAlCierre.reduce((a, b) => a + Number(b.monto_total || 0), 0)).toLocaleString('es-CL')}`,
    ];
    resumen.forEach((line) => { salto(); doc.text(line, marginX, y); y += lineGap; });

    if (egresos.length > 0) {
      y += 8; salto();
      doc.setFont('helvetica', 'bold'); doc.text('Detalle de egresos:', marginX, y); y += lineGap;
      doc.setFont('helvetica', 'normal');
      egresos.forEach((eg) => {
        salto();
        doc.text(`- ${eg.descripcion}: $${Number(eg.monto || 0).toLocaleString('es-CL')}`, marginX + 10, y);
        y += lineGap;
      });
    }

    if (fiadosAlCierre.length > 0) {
      y += 8; salto();
      doc.setFont('helvetica', 'bold'); doc.text('Cuentas pendientes (fiados) al cierre:', marginX, y); y += lineGap;
      doc.setFont('helvetica', 'normal');
      fiadosAlCierre.forEach((f) => {
        salto();
        doc.text(`- ${f.nombre}: $${Number(f.monto_total || 0).toLocaleString('es-CL')}`, marginX + 10, y);
        y += lineGap;
      });
    }

    const ranking = (() => {
      const acumulado = new Map();
      ventasParaRanking.forEach((v) => {
        const prev = acumulado.get(v.producto_nombre) || { nombre: v.producto_nombre, cantidad: 0 };
        prev.cantidad += Number(v.cantidad || 0);
        acumulado.set(v.producto_nombre, prev);
      });
      return Array.from(acumulado.values()).sort((a, b) => b.cantidad - a.cantidad);
    })();

    if (ranking.length > 0) {
      y += 8; salto();
      doc.setFont('helvetica', 'bold'); doc.text('Ranking de ventas del turno:', marginX, y); y += lineGap;
      doc.setFont('helvetica', 'normal');
      ranking.forEach((r, i) => {
        salto();
        doc.text(`${i + 1}. ${r.nombre}: ${r.cantidad} ud.`, marginX + 10, y);
        y += lineGap;
      });
    }

    if (totalesCierre.firma) {
      y += 12; salto();
      doc.setFont('helvetica', 'bold'); doc.text('Firma de cierre:', marginX, y); y += 6;
      try { doc.addImage(totalesCierre.firma, 'PNG', marginX, y, 160, 60); } catch { /* firma corrupta, se omite */ }
    }

    doc.save(`reporte-caja-${turno?.dia ? String(turno.dia).slice(0, 10) : hoyISO()}.pdf`);
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
      const totalesCierre = { cerradoPor: nombreCierre.trim(), firma: firmaCierre, ticketFinal };

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

      exportarCajaPdf(ventasDelTurno, fiados, totalesCierre);

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
          <div className="kiosco-grid">
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
                    <span className="kiosco-nombre" style={{ color: colorCat.text }}>{prod.nombre}</span>
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
              <div className="cart-items-list">
                {carrito.map((item) => (
                  <div key={item.id} className="cart-item-row">
                    <div className="cart-item-info"><span className="cart-item-cant">{item.cant}x</span><span className="cart-item-name">{item.nombre}</span></div>
                    <div className="cart-item-actions"><span className="cart-item-subtotal">${(item.precio * item.cant).toLocaleString('es-CL')}</span><button className="cart-btn-restar" onClick={() => { if (item.cant === 1) setCarrito(carrito.filter((i) => i.id !== item.id)); else setCarrito(carrito.map((i) => (i.id === item.id ? { ...i, cant: i.cant - 1 } : i))); }}>-</button></div>
                  </div>
                ))}
                <div className="cart-total-row mt-15"><span>TOTAL A PAGAR</span><h2>${totalCarrito.toLocaleString('es-CL')}</h2></div>
                <div className="cart-pay-buttons mt-15">
                  <button className="btn-pago efectivo" onClick={() => abrirModalPago('efectivo')}><Banknote size={16} /> Efectivo</button>
                  <button className="btn-pago transferencia" onClick={() => abrirModalPago('transferencia')}><Smartphone size={16} /> Transfer</button>
                  <button className="btn-pago" style={{ background: '#FF9500' }} onClick={() => abrirModalPago('fiado')}><NotebookPen size={16} /> Fiado</button>
                </div>
              </div>
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
            <div style={{ display: 'flex', gap: '10px' }} className="mt-10"><input type="text" className="form-input" style={{ flex: 2 }} placeholder="Glosa (Ej: Árbitros)" value={gastoRegistro.desc} onChange={(e) => setGastoRegistro({ ...gastoRegistro, desc: e.target.value })} /><input type="number" className="form-input" style={{ flex: 1 }} placeholder="Monto" value={gastoRegistro.monto} onChange={(e) => setGastoRegistro({ ...gastoRegistro, monto: e.target.value })} /><button className="btn-electric" style={{ background: 'var(--rojo-alerta)', width: 'auto', padding: '0 15px' }} onClick={registrarEgreso}>Restar</button></div>
            {egresos.length > 0 && (<div className="egresos-list mt-15"><span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)' }}>Egresos de Hoy</span>{egresos.map((eg) => (<div key={eg.id} className="egreso-row mt-5"><span className="egreso-desc" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><XCircle size={12} /> {eg.descripcion}</span><span className="egreso-monto">-${Number(eg.monto).toLocaleString('es-CL')}</span></div>))}</div>)}
          </div>
          <button className="btn-secondary mt-15" style={{ background: 'rgba(0,122,255,0.1)' }} onClick={() => exportarCajaPdf([], fiados, { cerradoPor: turno.responsable, firma: null, ticketFinal: ticketActual - 1 })}><FileDown size={18} color="var(--gris-secundario)" strokeWidth={1.5} /> Exportar Reporte Parcial (PDF)</button>
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
            </div>
            <button className="btn-electric" onClick={crearProducto}>Añadir al Catálogo</button>
          </div>
          <div className="card">
            <h4 className="form-subtitle">Stock Actual</h4>
            <div className="roster-list mt-10">
              {productos.map((prod) => (
                <div key={prod.id} className="roster-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', alignItems: 'center' }}>
                  <div><span style={{ fontSize: '24px', marginRight: '10px' }}>{prod.emoji}</span><strong style={{ color: 'var(--texto-principal)' }}>{prod.nombre}</strong><br /><span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: 'bold' }}>Costo: ${prod.costo} | Venta: ${prod.precio}</span></div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
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
              ))}
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
          {cargandoHistorial && <p className="text-muted text-center">Cargando...</p>}
          {!cargandoHistorial && historialTurnos.length === 0 && <p className="text-center text-muted card" style={{ fontStyle: 'italic' }}>Aún no hay turnos cerrados.</p>}
          {!cargandoHistorial && historialTurnos.map((t) => (
            <div key={t.id} className="card mb-10" style={{ padding: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ color: 'var(--texto-principal)' }}>{String(t.dia).slice(0, 10)}</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--texto-secundario)' }}>Responsable: {t.responsable} · Cerrado por: {t.cerrado_por || 'N/D'}</p>
                </div>
                <span style={{ fontWeight: '900', color: 'var(--verde-victoria)', fontSize: '16px' }}>${Number(t.caja_neta_final).toLocaleString('es-CL')}</span>
              </div>
              <div className="caja-doble-grid mt-10" style={{ gap: '8px' }}>
                <div className="desglose-row"><span>Efectivo</span><strong>${Number(t.total_efectivo_ventas).toLocaleString('es-CL')}</strong></div>
                <div className="desglose-row"><span>Transferencia</span><strong>${Number(t.total_transferencia_ventas).toLocaleString('es-CL')}</strong></div>
                <div className="desglose-row"><span>Egresos</span><strong style={{ color: 'var(--rojo-alerta)' }}>-${Number(t.total_egresos).toLocaleString('es-CL')}</strong></div>
                <div className="desglose-row"><span>Pendientes al cierre</span><strong style={{ color: '#FF9500' }}>${Number(t.total_pendientes).toLocaleString('es-CL')}</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default KioscoPanel;

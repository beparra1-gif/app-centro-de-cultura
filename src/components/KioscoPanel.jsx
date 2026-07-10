import { FileDown, ShieldAlert, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { nextId } from '../utils/runtimeId';
import { getColorPorCategoria } from '../utils/appHelpers';

function KioscoPanel({
  cajaAbierta,
  setCajaAbierta,
  datosCaja,
  setDatosCaja,
  vistaKiosco,
  setVistaKiosco,
  inventarioProductos,
  setInventarioProductos,
  carritoKiosco,
  setCarritoKiosco,
  modalPagoPOS,
  setModalPagoPOS,
  montoRecibidoEfectivo,
  setMontoRecibidoEfectivo,
  fiadosLista,
  setFiadosLista,
  nombreFiado,
  setNombreFiado,
  detalleFiado,
  setDetalleFiado,
  cajaEfectivoKiosco,
  setCajaEfectivoKiosco,
  cajaTransferKiosco,
  setCajaTransferKiosco,
  cajaEfectivoEntradas,
  setCajaEfectivoEntradas,
  cajaTransferEntradas,
  setCajaTransferEntradas,
  ticketCounter,
  setTicketCounter,
  egresosLista,
  setEgresosLista,
  gastoRegistro,
  setGastoRegistro,
  nuevoProducto,
  setNuevoProducto,
}) {
  const totalCarrito = carritoKiosco.reduce((a, b) => a + (b.precio * b.cant), 0);
  const totalGastos = egresosLista.reduce((a, b) => a + b.monto, 0);
  const cajaNetaFinal = (Number(datosCaja.montoInicial) || 0) + cajaEfectivoKiosco + cajaEfectivoEntradas - totalGastos;

  const exportarCajaPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginX = 40;
    let y = 50;
    const lineGap = 18;

    const resumen = [
      'CENTRO DE CULTURA FISICA - REPORTE DIARIO DE CAJA',
      `Fecha: ${datosCaja.dia || new Date().toISOString().slice(0, 10)}`,
      `Responsable: ${datosCaja.responsable || 'N/D'}`,
      `Ticket final: #${ticketCounter.toString().padStart(3, '0')}`,
      '---',
      `Apertura: $${Number(datosCaja.montoInicial || 0).toLocaleString('es-CL')}`,
      `Kiosco efectivo: $${Number(cajaEfectivoKiosco || 0).toLocaleString('es-CL')}`,
      `Kiosco transferencia: $${Number(cajaTransferKiosco || 0).toLocaleString('es-CL')}`,
      `Entradas efectivo: $${Number(cajaEfectivoEntradas || 0).toLocaleString('es-CL')}`,
      `Entradas transferencia: $${Number(cajaTransferEntradas || 0).toLocaleString('es-CL')}`,
      `Total egresos: $${Number(totalGastos || 0).toLocaleString('es-CL')}`,
      `Caja neta final: $${Number(cajaNetaFinal || 0).toLocaleString('es-CL')}`,
      `Pendientes (fiados): $${Number(fiadosLista.reduce((acc, f) => acc + Number(f.monto || 0), 0) || 0).toLocaleString('es-CL')}`,
    ];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(resumen[0], marginX, y);
    y += lineGap;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    resumen.slice(1).forEach((line) => {
      if (y > 780) {
        doc.addPage();
        y = 50;
      }
      doc.text(line, marginX, y);
      y += lineGap;
    });

    if (egresosLista.length > 0) {
      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('Detalle de egresos:', marginX, y);
      y += lineGap;
      doc.setFont('helvetica', 'normal');
      egresosLista.forEach((eg) => {
        if (y > 780) {
          doc.addPage();
          y = 50;
        }
        doc.text(`- ${eg.desc}: $${Number(eg.monto || 0).toLocaleString('es-CL')}`, marginX + 10, y);
        y += lineGap;
      });
    }

    doc.save(`reporte-caja-${datosCaja.dia || 'dia'}.pdf`);
  };

  const finalizarDespachoPOS = (metodo) => {
    let nuevoInventario = [...inventarioProductos];
    let sEK = 0;
    let sTK = 0;
    let sEE = 0;
    let sTE = 0;

    carritoKiosco.forEach(itemCart => {
      nuevoInventario = nuevoInventario.map(prod => (
        prod.id === itemCart.id ? { ...prod, stock: Math.max(0, prod.stock - itemCart.cant), ventas: prod.ventas + itemCart.cant } : prod
      ));
      const sub = itemCart.precio * itemCart.cant;
      const esEntrada = itemCart.categoria === 'Entradas';
      if (metodo === 'efectivo') {
        if (esEntrada) sEE += sub;
        else sEK += sub;
      } else {
        if (esEntrada) sTE += sub;
        else sTK += sub;
      }
    });

    setInventarioProductos(nuevoInventario);
    if (sEK > 0) setCajaEfectivoKiosco(p => p + sEK);
    if (sTK > 0) setCajaTransferKiosco(p => p + sTK);
    if (sEE > 0) setCajaEfectivoEntradas(p => p + sEE);
    if (sTE > 0) setCajaTransferEntradas(p => p + sTE);

    setTicketCounter(prev => prev + 1);
    setCarritoKiosco([]);
    setModalPagoPOS(null);
    setMontoRecibidoEfectivo('');
    alert(`Ticket #${ticketCounter.toString().padStart(3, '0')} generado con éxito.`);
  };

  const registrarCuentaPendiente = (e) => {
    e.preventDefault();
    const nuevaDeuda = {
      id: nextId(),
      nombre: nombreFiado,
      detalle: detalleFiado || carritoKiosco.map(i => `${i.cant}x ${i.nombre}`).join(', '),
      monto: totalCarrito,
      fecha: new Date().toLocaleDateString('es-CL'),
    };
    let nuevoInv = [...inventarioProductos];
    carritoKiosco.forEach(iC => {
      nuevoInv = nuevoInv.map(p => (p.id === iC.id ? { ...p, stock: Math.max(0, p.stock - iC.cant) } : p));
    });

    setInventarioProductos(nuevoInv);
    setFiadosLista([...fiadosLista, nuevaDeuda]);
    setCarritoKiosco([]);
    setModalPagoPOS(null);
    setNombreFiado('');
    setDetalleFiado('');
    setTicketCounter(c => c + 1);
    alert('La cuenta ha sido registrada en Fiados.');
  };

  if (!cajaAbierta) {
    return (
      <div className="fade-in text-center" style={{ padding: '40px 20px 120px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', boxSizing: 'border-box' }}>
        <div className="escudo-club-login" style={{ background: '#FF9500', color: 'white' }}>🔒</div>
        <h2 style={{ color: 'var(--texto-principal)', marginBottom: '8px' }}>Caja Bloqueada</h2>
        <p style={{ color: 'var(--texto-secundario)', maxWidth: '420px', margin: '0 auto 18px auto' }}>Completa los datos de apertura de turno para habilitar ventas.</p>
        <div className="card" style={{ textAlign: 'left', borderRadius: '24px', maxWidth: '520px', margin: '0 auto' }}>
          <div className="input-group mb-10"><label style={{ fontSize: '12px', fontWeight: '800' }}>Responsable de Turno</label><input type="text" className="form-input" value={datosCaja.responsable} onChange={(e) => setDatosCaja({ ...datosCaja, responsable: e.target.value })} placeholder="Ej: María Tesorera" /></div>
          <div className="input-group mb-10"><label style={{ fontSize: '12px', fontWeight: '800' }}>Fecha de Caja</label><input type="date" className="form-input" value={datosCaja.dia} onChange={(e) => setDatosCaja({ ...datosCaja, dia: e.target.value })} /></div>
          <div className="input-group mb-15"><label style={{ fontSize: '12px', fontWeight: '800' }}>Sencillo Inicial (CLP)</label><input type="number" className="form-input" value={datosCaja.montoInicial} onChange={(e) => setDatosCaja({ ...datosCaja, montoInicial: e.target.value })} placeholder="Ej: 20000" /></div>
          <button className="btn-electric" disabled={!datosCaja.responsable || !datosCaja.dia || !datosCaja.montoInicial} onClick={() => setCajaAbierta(true)}>DESBLOQUEAR SISTEMA</button>
        </div>
      </div>
    );
  }

  return (
    <div className="kiosco-container fade-in kiosco-shell">
      <div className="staff-header-info mb-15 kiosco-header-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.96) 100%)', padding: '16px 18px', borderRadius: '24px', boxShadow: '0 12px 28px rgba(15,23,42,0.06)', border: '1px solid rgba(255,255,255,0.72)' }}>
        <div><h4 style={{ margin: '0 0 5px 0', color: 'var(--texto-heading)', fontSize: '15px' }}>Caja Activa: {datosCaja.dia}</h4><span style={{ fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: 'bold' }}>👤 {datosCaja.responsable} | 🎫 Ticket: #{ticketCounter.toString().padStart(3, '0')}</span></div>
        <button className="btn-pill btn-danger" onClick={() => setCajaAbierta(false)}>Cerrar Turno</button>
      </div>

      {modalPagoPOS === 'efectivo' && (
        <div className="modal-overlay-alert"><div className="modal-alert-card text-center" style={{ borderRadius: '24px' }}><h3 style={{ fontWeight: '900' }}>Cobro Efectivo</h3><p>Total: <strong style={{ fontSize: '22px' }}>${totalCarrito.toLocaleString('es-CL')}</strong></p><div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }} className="mb-15"><button className="btn-secondary" style={{ padding: '10px', fontSize: '13px', borderRadius: '14px' }} onClick={() => setMontoRecibidoEfectivo(totalCarrito)}>Exacto</button><button className="btn-secondary" style={{ padding: '10px', fontSize: '13px', borderRadius: '14px' }} onClick={() => setMontoRecibidoEfectivo(10000)}>$10k</button><button className="btn-secondary" style={{ padding: '10px', fontSize: '13px', borderRadius: '14px' }} onClick={() => setMontoRecibidoEfectivo(20000)}>$20k</button></div><input type="number" className="form-input" placeholder="¿Con cuánto paga?" value={montoRecibidoEfectivo} onChange={(e) => setMontoRecibidoEfectivo(e.target.value)} />{Number(montoRecibidoEfectivo) >= totalCarrito && (<div className="vuelto-display">VUELTO: ${(Number(montoRecibidoEfectivo) - totalCarrito).toLocaleString('es-CL')}</div>)}<div className="modal-alert-buttons mt-20"><button className="btn-modal-cancelar" onClick={() => setModalPagoPOS(null)}>Atrás</button><button className="btn-modal-confirmar" style={{ background: 'linear-gradient(180deg, #34C759 0%, #28A745 100%)' }} onClick={() => { if (Number(montoRecibidoEfectivo) < totalCarrito) return alert('Falta dinero.'); finalizarDespachoPOS('efectivo'); }}>Cobrar</button></div></div></div>
      )}
      {modalPagoPOS === 'transferencia' && (
        <div className="modal-overlay-alert"><div className="modal-alert-card text-center" style={{ borderRadius: '24px' }}><ShieldAlert size={40} color="var(--azul-electrico)" style={{ margin: '0 auto 10px auto' }} /><h3 style={{ fontWeight: '900' }}>Validar Transferencia</h3><div className="modal-alert-buttons mt-20"><button className="btn-modal-cancelar" onClick={() => setModalPagoPOS(null)}>Cancelar</button><button className="btn-modal-confirmar" style={{ background: 'linear-gradient(180deg, #2f8cff 0%, var(--azul-electrico) 100%)' }} onClick={() => finalizarDespachoPOS('transferencia')}>Verificado</button></div></div></div>
      )}
      {modalPagoPOS === 'fiado' && (
        <div className="modal-overlay-alert"><div className="modal-alert-card"><h3 className="text-center">Dejar Pendiente</h3><form onSubmit={registrarCuentaPendiente}><input type="text" className="form-input mb-10" required placeholder="Nombre del responsable" value={nombreFiado} onChange={(e) => setNombreFiado(e.target.value)} /><input type="text" className="form-input mb-15" placeholder="Descripción adicional" value={detalleFiado} onChange={(e) => setDetalleFiado(e.target.value)} /><div className="modal-alert-buttons"><button type="button" className="btn-modal-cancelar" onClick={() => setModalPagoPOS(null)}>Cancelar</button><button type="submit" className="btn-modal-confirmar" style={{ background: '#FF9500' }}>Anotar Deuda</button></div></form></div></div>
      )}

      <div className="scroll-horizontal-menu mb-15">
        <div className="segment-control">
          <div className={`segment-btn ${vistaKiosco === 'pos' ? 'active' : ''}`} onClick={() => setVistaKiosco('pos')}>Vender</div>
          <div className={`segment-btn ${vistaKiosco === 'caja' ? 'active' : ''}`} onClick={() => setVistaKiosco('caja')}>Caja</div>
          <div className={`segment-btn ${vistaKiosco === 'inventario' ? 'active' : ''}`} onClick={() => setVistaKiosco('inventario')}>Inventario</div>
          <div className={`segment-btn ${vistaKiosco === 'analitica' ? 'active' : ''}`} onClick={() => setVistaKiosco('analitica')}>Analítica</div>
          <div className={`segment-btn ${vistaKiosco === 'fiados' ? 'active' : ''}`} onClick={() => setVistaKiosco('fiados')}>Pendientes</div>
        </div>
      </div>

      {vistaKiosco === 'pos' && (
        <div className="kiosco-tablet-layout">
          <div className="kiosco-grid">
            {inventarioProductos.map(prod => {
              const isCritico = prod.stock > 0 && prod.stock <= 5;
              const colorCat = getColorPorCategoria(prod.categoria);
              return (
                <div key={prod.id} className={`kiosco-item ${prod.stock <= 0 ? 'producto-agotado-card' : ''}`}
                  style={{ background: colorCat.bg, borderColor: colorCat.border }}
                  onClick={() => {
                    if (prod.stock > 0) {
                      const elem = document.getElementById(`prod-${prod.id}`);
                      if (elem) { elem.style.transform = 'scale(0.9)'; setTimeout(() => elem.style.transform = 'scale(1)', 100); }
                      const existente = carritoKiosco.find(i => i.id === prod.id);
                      if (existente) {
                        setCarritoKiosco(carritoKiosco.map(i => i.id === prod.id ? { ...i, cant: i.cant + 1 } : i));
                      } else {
                        setCarritoKiosco([...carritoKiosco, { ...prod, cant: 1 }]);
                      }
                    }
                  }}>
                  <div id={`prod-${prod.id}`} className="kiosco-item-inner" style={{ transition: '0.1s' }}>
                    <span className="kiosco-emoji">{prod.emoji}</span>
                    <span className="kiosco-nombre" style={{ color: colorCat.text }}>{prod.nombre}</span>
                    <span className="kiosco-stock-label" style={{ color: isCritico ? '#FF3B30' : colorCat.text }}>Stock: {prod.stock}</span>
                    <span className="kiosco-precio" style={{ color: colorCat.text }}>${prod.precio}</span>
                  </div>
                  {prod.stock <= 0 && <span className="badge-agotado-tag">AGOTADO</span>}
                  {isCritico && <span className="badge-critico-tag" style={{ position: 'absolute', top: 5, left: 5, background: '#FF9500', color: 'white', fontSize: '8px', padding: '2px 4px', borderRadius: '999px' }}>CRÍTICO</span>}
                </div>
              );
            })}
          </div>

          <div className="card kiosco-cart mt-20">
            <div className="cart-header-row">
              <h4 className="form-subtitle" style={{ margin: 0 }}>Ticket #{ticketCounter.toString().padStart(3, '0')}</h4>
              {carritoKiosco.length > 0 && (
                <button className="btn-borrar-carrito" onClick={() => { if (window.confirm('¿Borrar el contenido del carrito? El número de ticket se mantiene.')) { setCarritoKiosco([]); } }}>
                  🗑 Borrar Contenido
                </button>
              )}
            </div>
            {carritoKiosco.length === 0 && <p className="text-center text-muted" style={{ fontStyle: 'italic', margin: '20px 0' }}>Carrito vacío.</p>}
            {carritoKiosco.length > 0 && (
              <div className="cart-items-list">
                {carritoKiosco.map(item => (
                  <div key={item.id} className="cart-item-row">
                    <div className="cart-item-info"><span className="cart-item-cant">{item.cant}x</span><span className="cart-item-name">{item.nombre}</span></div>
                    <div className="cart-item-actions"><span className="cart-item-subtotal">${(item.precio * item.cant).toLocaleString('es-CL')}</span><button className="cart-btn-restar" onClick={() => { if (item.cant === 1) setCarritoKiosco(carritoKiosco.filter(i => i.id !== item.id)); else setCarritoKiosco(carritoKiosco.map(i => i.id === item.id ? { ...i, cant: i.cant - 1 } : i)); }}>-</button></div>
                  </div>
                ))}
                <div className="cart-total-row mt-15"><span>TOTAL A PAGAR</span><h2>${totalCarrito.toLocaleString('es-CL')}</h2></div>
                <div className="cart-pay-buttons mt-15">
                  <button className="btn-pago efectivo" onClick={() => setModalPagoPOS('efectivo')}>💵 Efectivo</button>
                  <button className="btn-pago transferencia" onClick={() => setModalPagoPOS('transferencia')}>📱 Transfer</button>
                  <button className="btn-pago" style={{ background: '#FF9500' }} onClick={() => setModalPagoPOS('fiado')}>📝 Fiado</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {vistaKiosco === 'caja' && (
        <div className="fade-in">
          <div className="checkout-total-box"><span style={{ color: 'rgba(255,255,255,0.7)' }}>Efectivo Físico Neto en Caja</span><h2 style={{ color: 'white', textShadow: 'none' }}>${cajaNetaFinal.toLocaleString('es-CL')}</h2><span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '8px' }}>Apertura: ${Number(datosCaja.montoInicial).toLocaleString('es-CL')}</span></div>
          <div className="caja-doble-grid mt-15">
            <div className="card sub-caja-card"><h5 className="sub-caja-title">📖 Kiosco</h5><div className="desglose-row"><span>Efec:</span><strong style={{ color: 'var(--verde-victoria)' }}>+${cajaEfectivoKiosco.toLocaleString('es-CL')}</strong></div><div className="desglose-row"><span>Trans:</span><strong>+${cajaTransferKiosco.toLocaleString('es-CL')}</strong></div></div>
            <div className="card sub-caja-card"><h5 className="sub-caja-title" style={{ color: 'var(--azul-electrico)' }}>🎟️ Entradas</h5><div className="desglose-row"><span>Efec:</span><strong style={{ color: 'var(--verde-victoria)' }}>+${cajaEfectivoEntradas.toLocaleString('es-CL')}</strong></div><div className="desglose-row"><span>Trans:</span><strong>+${cajaTransferEntradas.toLocaleString('es-CL')}</strong></div></div>
          </div>
          <div className="card mt-15">
            <h4 className="form-subtitle" style={{ color: '#FF3B30' }}><Wallet size={16} /> Registrar Egreso (Salida)</h4>
            <div style={{ display: 'flex', gap: '10px' }} className="mt-10"><input type="text" className="form-input" style={{ flex: 2 }} placeholder="Glosa (Ej: Árbitros)" value={gastoRegistro.desc} onChange={(e) => setGastoRegistro({ ...gastoRegistro, desc: e.target.value })} /><input type="number" className="form-input" style={{ flex: 1 }} placeholder="Monto" value={gastoRegistro.monto} onChange={(e) => setGastoRegistro({ ...gastoRegistro, monto: e.target.value })} /><button className="btn-electric" style={{ background: '#FF3B30', width: 'auto', padding: '0 15px' }} onClick={() => { if (!gastoRegistro.desc || !gastoRegistro.monto) return; setEgresosLista([...egresosLista, { id: nextId(), desc: gastoRegistro.desc, monto: Number(gastoRegistro.monto) }]); setGastoRegistro({ desc: '', monto: '' }); }}>Restar</button></div>
            {egresosLista.length > 0 && (<div className="egresos-list mt-15"><span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--texto-secundario)' }}>Egresos de Hoy</span>{egresosLista.map(eg => (<div key={eg.id} className="egreso-row mt-5"><span className="egreso-desc">❌ {eg.desc}</span><span className="egreso-monto">-${eg.monto.toLocaleString('es-CL')}</span></div>))}</div>)}
          </div>
          <button className="btn-secondary mt-15" style={{ background: 'rgba(0,122,255,0.1)' }} onClick={exportarCajaPdf}><FileDown size={18} /> Exportar Reporte del Día (PDF)</button>
        </div>
      )}

      {vistaKiosco === 'inventario' && (
        <div className="fade-in">
          <div className="card mb-15">
            <h4 className="form-subtitle">Crear Producto / Ingreso</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }} className="mb-10">
              <input type="text" className="form-input" placeholder="Nombre" value={nuevoProducto.nombre} onChange={(e) => setNuevoProducto({ ...nuevoProducto, nombre: e.target.value })} />
              <input type="text" className="form-input" placeholder="Emoji (Ej: 🍫)" value={nuevoProducto.emoji} onChange={(e) => setNuevoProducto({ ...nuevoProducto, emoji: e.target.value })} />
              <input type="number" className="form-input" placeholder="Costo Compra ($)" value={nuevoProducto.costo} onChange={(e) => setNuevoProducto({ ...nuevoProducto, costo: e.target.value })} />
              <input type="number" className="form-input" placeholder="Precio Venta ($)" value={nuevoProducto.precio} onChange={(e) => setNuevoProducto({ ...nuevoProducto, precio: e.target.value })} />
              <select className="form-input" style={{ gridColumn: '1 / -1' }} value={nuevoProducto.categoria} onChange={(e) => setNuevoProducto({ ...nuevoProducto, categoria: e.target.value })}>
                <option value="Bebida">Bebida</option><option value="Comida">Comida</option><option value="Entradas">Entradas/Otros</option>
              </select>
            </div>
            <button className="btn-electric" onClick={() => {
              if (!nuevoProducto.nombre || !nuevoProducto.precio) return alert('Faltan datos');
              setInventarioProductos([...inventarioProductos, { id: nextId(), ...nuevoProducto, stock: 10, ventas: 0 }]);
              setNuevoProducto({ nombre: '', emoji: '', costo: '', precio: '', categoria: 'Bebida' }); alert('Producto Creado');
            }}>Añadir al Catálogo</button>
          </div>
          <div className="card">
            <h4 className="form-subtitle">Stock Actual</h4>
            <div className="roster-list mt-10">
              {inventarioProductos.map(prod => (
                <div key={prod.id} className="roster-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', alignItems: 'center' }}>
                  <div><span style={{ fontSize: '24px', marginRight: '10px' }}>{prod.emoji}</span><strong style={{ color: 'var(--texto-principal)' }}>{prod.nombre}</strong><br /><span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: 'bold' }}>Costo: ${prod.costo} | Venta: ${prod.precio}</span></div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button className="btn-circle btn-danger" onClick={() => setInventarioProductos(inventarioProductos.map(p => p.id === prod.id ? { ...p, stock: Math.max(0, p.stock - 1) } : p))}>-</button>
                      <input type="number" style={{ width: '50px', textAlign: 'center', padding: '4px 4px', border: '1.5px solid var(--borde-suave)', borderRadius: '999px', background: 'var(--fondo-input)', color: prod.stock <= 5 ? '#FF3B30' : 'var(--texto-principal)', fontWeight: '900', fontSize: '14px' }} value={prod.stock} onChange={(e) => setInventarioProductos(inventarioProductos.map(p => p.id === prod.id ? { ...p, stock: Math.max(0, parseInt(e.target.value, 10) || 0) } : p))} />
                      <button className="btn-circle btn-success" onClick={() => setInventarioProductos(inventarioProductos.map(p => p.id === prod.id ? { ...p, stock: p.stock + 1 } : p))}>+</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--fondo-input)', padding: '4px 8px', borderRadius: '999px', border: '1.5px solid var(--borde-suave)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: '800' }}>$</span>
                      <input type="number" style={{ width: '64px', border: 'none', background: 'transparent', color: 'var(--texto-principal)', fontWeight: '900', fontSize: '13px', textAlign: 'center', outline: 'none' }} value={prod.precio} onChange={(e) => setInventarioProductos(inventarioProductos.map(p => p.id === prod.id ? { ...p, precio: parseInt(e.target.value, 10) || 0 } : p))} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {vistaKiosco === 'analitica' && (
        <div className="fade-in">
          <h3 className="section-title">Inteligencia de Negocio</h3>
          <div className="card" style={{ borderLeft: '4px solid var(--verde-victoria)' }}>
            <h4 className="form-subtitle"><TrendingUp size={16} color="var(--verde-victoria)" /> Top 3 Más Vendidos</h4>
            {[...inventarioProductos].sort((a, b) => b.ventas - a.ventas).slice(0, 3).map((p, i) => (
              <div key={p.id} className="desglose-row mt-10" style={{ fontSize: '15px' }}><span>{i + 1}. {p.emoji} {p.nombre}</span><strong style={{ color: 'var(--verde-victoria)' }}>{p.ventas} ud.</strong></div>
            ))}
          </div>
          <div className="card mt-15" style={{ borderLeft: '4px solid #FF3B30' }}>
            <h4 className="form-subtitle"><TrendingDown size={16} color="#FF3B30" /> Menos Movimiento</h4>
            {[...inventarioProductos].sort((a, b) => a.ventas - b.ventas).slice(0, 2).map((p) => (
              <div key={p.id} className="desglose-row mt-10" style={{ fontSize: '15px' }}><span>{p.emoji} {p.nombre}</span><strong style={{ color: '#FF3B30' }}>{p.ventas} ud.</strong></div>
            ))}
          </div>
        </div>
      )}

      {vistaKiosco === 'fiados' && (
        <div className="fade-in">
          <div className="checkout-total-box mb-15" style={{ background: 'linear-gradient(135deg, #FF9500, #E65100)', border: 'none', padding: '20px' }}><span style={{ color: 'rgba(255,255,255,0.8)' }}>Dinero en la calle</span><h2 style={{ color: 'white', textShadow: 'none', fontSize: '32px' }}>${fiadosLista.reduce((a, b) => a + b.monto, 0).toLocaleString('es-CL')}</h2></div>
          {fiadosLista.length === 0 ? <p className="text-center text-muted card" style={{ fontStyle: 'italic' }}>Sin deudas pendientes hoy.</p> : null}
          {fiadosLista.map(f => (
            <div key={f.id} className="card" style={{ borderLeft: '4px solid #FF9500', padding: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><h4 style={{ margin: 0, color: 'var(--texto-principal)' }}>{f.nombre}</h4><span style={{ fontWeight: '900', color: '#FF9500', fontSize: '16px' }}>${f.monto.toLocaleString('es-CL')}</span></div>
              <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', margin: '8px 0' }}>{f.detalle}</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button className="btn-pill btn-success" style={{ flex: 1 }} onClick={() => { if (window.confirm('¿Deuda cancelada en EFECTIVO?')) { setCajaEfectivoKiosco(p => p + f.monto); setFiadosLista(fiadosLista.filter(i => i.id !== f.id)); setTicketCounter(c => c + 1); } }}>💵 Efectivo</button>
                <button className="btn-pill" style={{ flex: 1 }} onClick={() => { if (window.confirm('¿Deuda cancelada por TRANSFERENCIA?')) { setCajaTransferKiosco(p => p + f.monto); setFiadosLista(fiadosLista.filter(i => i.id !== f.id)); setTicketCounter(c => c + 1); } }}>📱 Transfer</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default KioscoPanel;

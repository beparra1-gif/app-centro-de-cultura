import { useState } from 'react';
import { AlertTriangle, Check, User } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import { payloadReclasificacion } from '../utils/pagosMalClasificados';

// Tesorería → Validar pagos: pagos de deportistas guardados como cuota de
// socio (ver utils/pagosMalClasificados). Un admin decide caso a caso:
//  - "Es mensualidad del deportista": concepto → "Mensualidad".
//  - "Es cuota de socio": se deja como cuota y se quita el RUT del deportista.
// Ambas acciones dejan nota en el pago (y en la auditoría del backend).

const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;

export default function RevisionClasificacionPagos({ items = [], autor = '', onActualizado }) {
  const [procesando, setProcesando] = useState(null);

  const aplicar = async (lista, accion) => {
    setProcesando(lista.length === 1 ? lista[0].id : 'lote');
    let ok = 0;
    try {
      for (const item of lista) {
        await api.pagosMensualidadesAPI.update(item.id, payloadReclasificacion(item.pago, accion, autor));
        ok += 1;
      }
      showToast({
        message: accion === 'mensualidad'
          ? `${ok} ${ok === 1 ? 'pago pasó' : 'pagos pasaron'} a mensualidad del deportista.`
          : 'Pago confirmado como cuota de socio.',
        type: 'success',
      });
    } catch (error) {
      showToast({ message: `Se corrigieron ${ok} de ${lista.length}. Error: ${error.message || 'no se pudo guardar'}`, type: 'error' });
    } finally {
      setProcesando(null);
      await onActualizado?.();
    }
  };

  const pasarAMensualidad = async (item) => {
    const confirmado = await confirmAction({
      title: 'Pasar a mensualidad del deportista',
      message: `El pago de ${pesos(item.monto)} (${item.mes}) dejará de contar como cuota de socio de ${item.pagador || 'quien paga'} y pasará a ser la mensualidad de ${item.deportista}. Revisa después la cuota de socio de ese mes.`,
      confirmText: 'Pasar a mensualidad',
    });
    if (confirmado) await aplicar([item], 'mensualidad');
  };

  const confirmarSocio = async (item) => {
    const confirmado = await confirmAction({
      title: 'Confirmar como cuota de socio',
      message: `El pago de ${pesos(item.monto)} (${item.mes}) se mantiene como cuota de socio de ${item.pagador}. Solo se quita el RUT de ${item.deportista} para que no vuelva a aparecer aquí.`,
      confirmText: 'Es cuota de socio',
    });
    if (confirmado) await aplicar([item], 'socio');
  };

  const seguros = items.filter((i) => i.cuotaSocioPagadaAparte);
  const pasarSeguros = async () => {
    const confirmado = await confirmAction({
      title: `Pasar ${seguros.length} pagos a mensualidad`,
      message: `En estos ${seguros.length} casos la cuota de socio de ese mes ya está pagada aparte, así que el pago era la mensualidad del deportista. Se pasarán todos a "Mensualidad" y quedará una nota en cada uno.`,
      confirmText: 'Pasar todos',
    });
    if (confirmado) await aplicar(seguros, 'mensualidad');
  };

  if (items.length === 0) return null;

  return (
    <section className="rc-card" aria-labelledby="rc-titulo">
      <div className="rc-header">
        <AlertTriangle size={18} color="var(--naranja-aviso)" />
        <div>
          <h4 id="rc-titulo">Pagos de deportistas guardados como cuota de socio ({items.length})</h4>
          <p>
            Un error del pago manual (ya corregido) guardaba la mensualidad de un hijo como cuota de socio de su apoderado:
            el hijo quedaba moroso y la cuota del apoderado aparecía pagada. Revisa cada caso.
          </p>
        </div>
      </div>

      {seguros.length > 1 && (
        <button type="button" className="btn-secondary rc-lote" disabled={Boolean(procesando)} onClick={pasarSeguros}>
          <Check size={14} /> Pasar a mensualidad los {seguros.length} casos con la cuota de socio pagada aparte
        </button>
      )}

      <div className="rc-lista">
        {items.map((item) => (
          <div key={item.id} className="rc-item">
            <div className="rc-item-texto">
              <strong>{item.deportista}</strong>
              <span>
                {item.mes} · {pesos(item.monto)} · {item.estado === 'aprobado' || item.estado === 'validado' ? 'aprobado' : item.estado}
              </span>
              <span className="rc-pagador"><User size={11} /> Pagó: {item.pagador || 'sin cuenta registrada'}</span>
              {item.cuotaSocioPagadaAparte && (
                <span className="rc-pista">La cuota de socio de ese mes ya está pagada aparte → era la mensualidad</span>
              )}
            </div>
            <div className="rc-item-botones">
              <button type="button" className="tc-btn-pagar" disabled={Boolean(procesando)} onClick={() => pasarAMensualidad(item)}>
                {procesando === item.id ? 'Guardando…' : 'Es mensualidad del deportista'}
              </button>
              <button
                type="button"
                className="btn-secondary tc-btn"
                disabled={Boolean(procesando) || !item.pagadorEsSocio}
                title={item.pagadorEsSocio ? undefined : 'Quien pagó no es socio: no puede ser cuota de socio'}
                onClick={() => confirmarSocio(item)}
              >
                Es cuota de socio
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

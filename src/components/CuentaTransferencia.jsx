import { Copy } from 'lucide-react';
import { showToast } from '../utils/toast';

export default function CuentaTransferencia({ cuenta, monto = 0 }) {
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(cuenta.filas.map(([k, v]) => `${k}: ${v}`).join('\n'));
      showToast({ message: 'Datos de la cuenta copiados. Pégalos en tu transferencia.', type: 'success' });
    } catch {
      showToast({ message: 'No se pudo copiar. Mantén presionado el texto para copiarlo a mano.', type: 'error' });
    }
  };
  return (
    <section className="ct-cuenta" aria-label={cuenta.titulo}>
      <div className="ct-cabecera">
        <strong>{cuenta.titulo}</strong>
        {monto > 0 && <span className="ct-monto">Transfiere ${monto.toLocaleString('es-CL')}</span>}
      </div>
      <dl>
        {cuenta.filas.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      <button type="button" className="ct-copiar" onClick={copiar}><Copy size={16} aria-hidden="true" /> Copiar datos de la cuenta</button>
    </section>
  );
}

import { CheckCircle2, CreditCard, Upload } from 'lucide-react';

// Muro (socios, apoderados y deportistas que pagan sus cuotas): lo que debe
// la familia y un acceso directo a subir el comprobante. "Subir comprobante"
// deja marcados los meses adeudados en Mi Cuenta, así solo falta adjuntarlo.

// El resumen de deuda se arma en utils/deudaFamilia.js.
const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;

export default function PagoRapidoMuro({ resumen, onPagar, onVerCuenta }) {
  const { lineas, total } = resumen;
  const debe = total > 0;
  return (
    <section className={`prm-card ${debe ? 'prm-debe' : 'prm-ok'}`} aria-labelledby="prm-titulo">
      <div className="prm-cabecera">
        <span className="prm-icono" aria-hidden="true">{debe ? <CreditCard size={22} /> : <CheckCircle2 size={22} />}</span>
        <div>
          <h3 id="prm-titulo">{debe ? `Tienes ${pesos(total)} pendiente` : '¡Estás al día con tus pagos!'}</h3>
          <p>{debe ? 'Paga por transferencia y sube aquí el comprobante. Tesorería lo valida.' : 'Puedes adelantar meses o revisar tu historial en Mi Cuenta.'}</p>
        </div>
      </div>
      {debe && (
        <ul className="prm-lineas">
          {lineas.map((l) => (
            <li key={l.clave}>
              <span><b>{l.nombre}</b> · {l.meses.join(', ')}</span>
              <strong>{pesos(l.monto)}</strong>
            </li>
          ))}
        </ul>
      )}
      <div className="prm-acciones">
        {debe ? (
          <button type="button" className="prm-boton" onClick={() => onPagar(lineas)}>
            <Upload size={18} /> Subir comprobante de pago
          </button>
        ) : (
          <button type="button" className="prm-boton prm-boton-sec" onClick={onVerCuenta}>
            <CreditCard size={18} /> Ver mis pagos
          </button>
        )}
      </div>
    </section>
  );
}

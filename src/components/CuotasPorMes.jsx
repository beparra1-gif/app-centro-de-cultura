import { useState } from 'react';
import { ANIO_INFORME } from '../utils/informeDeuda';

// Editar deportista → "Personalizar mensualidad por mes": monto a cobrar en
// meses puntuales (cuotas_por_mes = { "2026-03": 10000 }). Un mes vacío usa la
// cuota normal (cuota especial o tarifa del club). Al desmarcar se borran.
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const clave = (i) => `${ANIO_INFORME}-${String(i + 1).padStart(2, '0')}`;

export default function CuotasPorMes({ valor = {}, onCambiar, cuotaNormal }) {
  const cuotas = valor && typeof valor === 'object' ? valor : {};
  const [activo, setActivo] = useState(Object.keys(cuotas).length > 0);

  const cambiarMes = (i, texto) => {
    const sig = { ...cuotas };
    if (texto === '') delete sig[clave(i)];
    else sig[clave(i)] = Number(texto);
    onCambiar(sig);
  };

  return (
    <div className="cpm">
      <label className="checkbox-label-row">
        <input
          type="checkbox"
          checked={activo}
          onChange={(e) => { setActivo(e.target.checked); if (!e.target.checked) onCambiar({}); }}
        />
        Personalizar mensualidad por mes ({ANIO_INFORME})
      </label>
      {activo && (
        <>
          <p className="pf-ayuda">
            Escribe el monto a cobrar solo en los meses distintos. Los meses vacíos se cobran con la cuota normal
            {cuotaNormal ? ` (${cuotaNormal})` : ''}. Para que un mes no se cobre, escribe 0.
          </p>
          <div className="cpm-grilla">
            {MESES.map((m, i) => (
              <label key={m} className="cpm-mes">
                <span>{m}</span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  inputMode="numeric"
                  className="form-input"
                  value={cuotas[clave(i)] ?? ''}
                  placeholder="Normal"
                  aria-label={`Cuota de ${m} ${ANIO_INFORME}`}
                  onChange={(e) => cambiarMes(i, e.target.value)}
                />
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

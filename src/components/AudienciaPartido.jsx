import { useState } from 'react';
import { Users } from 'lucide-react';
import { describirAudiencia, destinatariosPartido } from '../utils/audienciaPartido';

// "¿Quién lo verá?" del formulario de Resultados: la categoría del partido,
// deportistas elegidos a mano o todo el club. Siempre muestra el resumen.
export default function AudienciaPartido({ partido, jugadores = [], onCambiar }) {
  const [busqueda, setBusqueda] = useState('');
  const audiencia = partido.audiencia || { tipo: 'todos' };
  const elegidos = new Set(audiencia.ruts || []);
  const cambiarTipo = (tipo) => onCambiar({ tipo, ...(tipo === 'personas' ? { ruts: audiencia.ruts || [] } : {}) });
  const alternar = (rut) => {
    const ruts = elegidos.has(rut) ? [...elegidos].filter((r) => r !== rut) : [...elegidos, rut];
    onCambiar({ tipo: 'personas', ruts });
  };
  const q = busqueda.trim().toLowerCase();
  const candidatos = q
    ? jugadores.filter((j) => `${j.nombres} ${j.apellido_paterno} ${j.rut_jugador} ${j.categoria}`.toLowerCase().includes(q)).slice(0, 30)
    : [];
  const seleccionados = destinatariosPartido({ audiencia: { tipo: 'personas', ruts: [...elegidos] } }, jugadores);
  const categoria = [partido.rama, partido.categoria].filter(Boolean).join(' ');

  return (
    <fieldset className="ap-audiencia">
      <legend><Users size={15} aria-hidden="true" /> ¿Quién lo verá?</legend>
      <label><input type="radio" name="audiencia-partido" checked={audiencia.tipo === 'categoria'} onChange={() => cambiarTipo('categoria')} /> Deportistas de {categoria || 'la categoría del partido'} y sus familias</label>
      <label><input type="radio" name="audiencia-partido" checked={audiencia.tipo === 'personas'} onChange={() => cambiarTipo('personas')} /> Solo deportistas que yo elija</label>
      <label><input type="radio" name="audiencia-partido" checked={audiencia.tipo === 'todos'} onChange={() => cambiarTipo('todos')} /> Todo el club y la portada pública</label>

      {audiencia.tipo === 'personas' && (
        <div className="ap-personas">
          <input className="form-input" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar deportista por nombre, RUT o categoría" aria-label="Buscar deportista" />
          {candidatos.map((j) => (
            <label key={j.rut_jugador} className="ap-candidato">
              <input type="checkbox" checked={elegidos.has(j.rut_jugador)} onChange={() => alternar(j.rut_jugador)} />
              {`${j.nombres || ''} ${j.apellido_paterno || ''}`.trim()} <small>{j.categoria}</small>
            </label>
          ))}
          {seleccionados.length > 0 && (
            <div className="ap-chips">
              {seleccionados.map((j) => (
                <button key={j.rut_jugador} type="button" onClick={() => alternar(j.rut_jugador)} aria-label={`Quitar a ${j.nombres}`}>
                  {`${j.nombres || ''} ${j.apellido_paterno || ''}`.trim()} ×
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="ap-resumen" role="status">{describirAudiencia(partido, jugadores)}. El staff y quienes administran resultados siempre lo ven.</p>
    </fieldset>
  );
}

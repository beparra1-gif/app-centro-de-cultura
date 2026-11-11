import { useEffect, useState } from 'react';
import { Cake, ChevronDown, ChevronUp } from 'lucide-react';
import * as api from '../api/client';
import { absolutizarLogoUrl } from '../utils/logoResolver';

// Widget fijo del Muro: cumpleaños del mes del club. Los de HOY van
// destacados con su foto de perfil; abajo, los próximos días del mes. Solo
// con sesión (el endpoint lo exige) y con datos mínimos: nombre, día,
// categoría y foto — nunca año ni edad.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const iniciales = (nombre = '') => nombre.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

function FotoPersona({ foto, nombre, size }) {
  const [fallo, setFallo] = useState(false);
  const url = foto ? absolutizarLogoUrl(foto) : '';
  return (
    <span className="mc-foto" style={{ width: size, height: size, fontSize: Math.round(size / 2.8) }} aria-hidden="true">
      {url && !fallo ? <img src={url} alt="" loading="lazy" onError={() => setFallo(true)} /> : iniciales(nombre)}
    </span>
  );
}

export default function MuroCumpleanos() {
  const [lista, setLista] = useState([]);
  const [verTodos, setVerTodos] = useState(false);
  const hoy = new Date();
  const mes = hoy.getMonth() + 1;
  const diaHoy = hoy.getDate();

  useEffect(() => {
    let activo = true;
    api.cumpleanosAPI.delMes(mes)
      .then((datos) => { if (activo) setLista(Array.isArray(datos) ? datos : []); })
      .catch(() => { if (activo) setLista([]); }); // sin sesión o sin datos: no se muestra
    return () => { activo = false; };
  }, [mes]);

  const deHoy = lista.filter((c) => c.dia === diaHoy);
  const proximos = lista.filter((c) => c.dia > diaHoy);
  const pasados = lista.filter((c) => c.dia < diaHoy);
  if (lista.length === 0) return null;

  const tira = verTodos ? lista.filter((c) => c.dia !== diaHoy) : proximos;

  return (
    <section className="mc-card" aria-label="Cumpleaños del club">
      <header className="mc-cabecera">
        <Cake size={18} aria-hidden="true" />
        <h3>Cumpleaños de {MESES[mes - 1]}</h3>
      </header>

      {deHoy.length > 0 && (
        <div className="mc-hoy">
          {deHoy.map((c) => (
            <div key={c.id} className="mc-hoy-persona">
              <FotoPersona foto={c.foto} nombre={c.nombre} size={72} />
              <div>
                <span className="mc-hoy-etiqueta">¡Hoy está de cumpleaños!</span>
                <strong>{c.nombre}</strong>
                {c.categoria && <small>{c.categoria}</small>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tira.length > 0 && (
        <>
          {!verTodos && <p className="mc-subtitulo">Próximos</p>}
          <div className="mc-tira">
            {tira.map((c) => (
              <div key={c.id} className={`mc-persona ${c.dia < diaHoy ? 'pasado' : ''}`}>
                <FotoPersona foto={c.foto} nombre={c.nombre} size={48} />
                <strong>{c.nombre.split(' ')[0]}</strong>
                <small>{c.dia} de {MESES[mes - 1].slice(0, 3)}</small>
              </div>
            ))}
          </div>
        </>
      )}
      {deHoy.length === 0 && tira.length === 0 && <p className="mc-subtitulo">No quedan cumpleaños este mes.</p>}

      {pasados.length > 0 && (
        <button type="button" className="mc-ver-todos" onClick={() => setVerTodos((v) => !v)} aria-expanded={verTodos}>
          {verTodos ? <><ChevronUp size={14} /> Ver solo los próximos</> : <><ChevronDown size={14} /> Ver todo el mes ({lista.length})</>}
        </button>
      )}
    </section>
  );
}

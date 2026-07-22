import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import LogoPicker from './LogoPicker';
import LogoAvatar from './LogoAvatar';
import { showToast } from '../utils/toast';
import { confirmAction } from '../utils/confirmDialog';
import * as api from '../api/client';

// Reutiliza LogoPicker tal cual (mismo componente que ya usan Citaciones y
// Resultados para elegir rival) — si el nombre ya existe en el directorio de
// clubes, autocompleta el logo; si es nuevo, LogoPicker ya trae su propio
// botón "+ Guardar en el directorio de clubes".
function TorneoEquiposManager({ idTorneo, equipos = [], onEquiposChanged }) {
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [logoNuevo, setLogoNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);

  const agregarEquipo = async () => {
    if (!nombreNuevo.trim()) {
      showToast({ message: 'Ponle un nombre al equipo.', type: 'error' });
      return;
    }
    setGuardando(true);
    try {
      await api.torneosAPI.equipos.create(idTorneo, { nombre_equipo: nombreNuevo.trim(), logo_url: logoNuevo || null });
      showToast({ message: `${nombreNuevo.trim()} agregado al torneo.`, type: 'success' });
      setNombreNuevo('');
      setLogoNuevo('');
      if (onEquiposChanged) await onEquiposChanged();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo agregar el equipo.', type: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  const eliminarEquipo = async (equipo) => {
    if (!(await confirmAction({ title: 'Quitar equipo', message: `¿Confirmas quitar a ${equipo.nombre_equipo} de este torneo?`, danger: true }))) return;
    try {
      await api.torneosAPI.equipos.remove(idTorneo, equipo.id_equipo);
      showToast({ message: 'Equipo quitado del torneo.', type: 'success' });
      if (onEquiposChanged) await onEquiposChanged();
    } catch (error) {
      showToast({ message: error.message || 'No se pudo quitar el equipo.', type: 'error' });
    }
  };

  return (
    <div>
      <h5 style={{ margin: '0 0 10px', fontSize: '13px' }}>Equipos del torneo</h5>

      {equipos.length === 0 && (
        <p className="text-muted italic" style={{ fontSize: '12px' }}>Todavía no hay equipos agregados.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
        {equipos.map((eq) => (
          <div key={eq.id_equipo} style={{ display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid var(--borde-suave)', borderRadius: '12px', padding: '6px 10px' }}>
            <LogoAvatar nombre={eq.nombre_equipo} logoUrl={eq.logo_url} tipo="club" size={28} borderRadius="8px" />
            <span style={{ flex: 1, fontSize: '13px', fontWeight: '700' }}>{eq.nombre_equipo}</span>
            <button
              type="button"
              onClick={() => eliminarEquipo(eq)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', padding: '4px' }}
              aria-label={`Quitar ${eq.nombre_equipo}`}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px' }}>
          <LogoPicker
            label="Nuevo equipo"
            nombre={nombreNuevo}
            onNombre={setNombreNuevo}
            logoUrl={logoNuevo}
            onLogoUrl={setLogoNuevo}
            tipo="club"
            placeholder="Nombre del equipo..."
          />
        </div>
        <button className="btn-secondary" style={{ width: 'auto', padding: '10px 14px' }} onClick={agregarEquipo} disabled={guardando}>
          <Plus size={14} /> {guardando ? 'Agregando...' : 'Agregar'}
        </button>
      </div>
    </div>
  );
}

export default TorneoEquiposManager;

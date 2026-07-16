import { useState } from 'react';
import { Lock, Save, X } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';

const CAMPOS_APODERADO = [
  { campo: 'nombres', etiqueta: 'Nombres' },
  { campo: 'apellido_paterno', etiqueta: 'Apellido paterno' },
  { campo: 'apellido_materno', etiqueta: 'Apellido materno' },
  { campo: 'fecha_nacimiento', etiqueta: 'Fecha de nacimiento', tipo: 'date' },
  { campo: 'año_nacimiento', etiqueta: 'Año de nacimiento', tipo: 'number' },
  { campo: 'colegio', etiqueta: 'Colegio' },
  { campo: 'parentesco_apoderado', etiqueta: 'Parentesco del apoderado' },
  { campo: 'posicion_de_juego', etiqueta: 'Posición de juego' },
  { campo: 'estatura', etiqueta: 'Estatura' },
  { campo: 'peso', etiqueta: 'Peso' },
  { campo: 'mano_habil', etiqueta: 'Mano hábil' },
  { campo: 'club_anterior', etiqueta: 'Club anterior' },
  { campo: 'talla_camiseta', etiqueta: 'Talla camiseta' },
  { campo: 'talla_short', etiqueta: 'Talla short' },
  { campo: 'foto_jugador', etiqueta: 'Foto del jugador (URL)' },
  { campo: 'prevision', etiqueta: 'Previsión' },
  { campo: 'tipo_sangre', etiqueta: 'Tipo de sangre' },
  { campo: 'alergias', etiqueta: 'Alergias' },
  { campo: 'nombre_emergencia', etiqueta: 'Nombre contacto emergencia' },
  { campo: 'parentesco_emergencia', etiqueta: 'Parentesco contacto emergencia' },
  { campo: 'num_emergencia', etiqueta: 'Teléfono contacto emergencia' },
  { campo: 'derechos_imagen', etiqueta: 'Autoriza derechos de imagen', tipo: 'checkbox' },
];

const CAMPOS_SOLO_ADMIN = [
  { campo: 'rut_apoderado', etiqueta: 'RUT apoderado (vínculo de cuenta)' },
  { campo: 'correo_apoderado', etiqueta: 'Correo apoderado' },
  { campo: 'correo_jugador', etiqueta: 'Correo del jugador' },
  { campo: 'forzar_clave_jugador', etiqueta: 'Forzar cambio de clave', tipo: 'checkbox' },
  { campo: 'rama', etiqueta: 'Rama' },
  { campo: 'categoria', etiqueta: 'Categoría' },
  { campo: 'numero_camiseta', etiqueta: 'Número camiseta' },
  { campo: 'fecha_ingreso', etiqueta: 'Fecha de ingreso', tipo: 'date' },
  { campo: 'mes_inicio_cobro', etiqueta: 'Mes inicio cobro' },
  { campo: 'beca', etiqueta: 'Beca' },
  { campo: 'valor_mensualidad', etiqueta: 'Valor mensualidad' },
  { campo: 'matricula_pagada', etiqueta: 'Matrícula pagada', tipo: 'checkbox' },
  { campo: 'polera_entregada', etiqueta: 'Polera entregada', tipo: 'checkbox' },
  { campo: 'poleron_entregado', etiqueta: 'Polerón entregado', tipo: 'checkbox' },
  { campo: 'estado', etiqueta: 'Estado' },
  { campo: 'estado_deportivo', etiqueta: 'Estado deportivo' },
  { campo: 'fecha_inicio_baja', etiqueta: 'Fecha inicio baja', tipo: 'date' },
  { campo: 'fecha_fin_baja', etiqueta: 'Fecha fin baja', tipo: 'date' },
  { campo: 'xp_puntos', etiqueta: 'XP puntos', tipo: 'number' },
];

const construirValoresIniciales = (jugador) => {
  const inicial = {};
  [...CAMPOS_APODERADO, ...CAMPOS_SOLO_ADMIN].forEach(({ campo, tipo }) => {
    const raw = jugador?.[campo];
    if (tipo === 'checkbox') {
      inicial[campo] = Boolean(raw);
    } else if (tipo === 'date' && raw) {
      inicial[campo] = String(raw).slice(0, 10);
    } else {
      inicial[campo] = raw ?? '';
    }
  });
  return inicial;
};

function EditarJugadorModal({ jugador, esAdmin, onClose, onSaved }) {
  const [valores, setValores] = useState(() => construirValoresIniciales(jugador));
  const [guardando, setGuardando] = useState(false);

  if (!jugador) return null;

  const actualizarCampo = (campo, valor) => {
    setValores((prev) => ({ ...prev, [campo]: valor }));
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const payload = {};
      [...CAMPOS_APODERADO, ...(esAdmin ? CAMPOS_SOLO_ADMIN : [])].forEach(({ campo }) => {
        const valor = valores[campo];
        payload[campo] = valor === '' ? null : valor;
      });
      const actualizado = await api.jugadoresAPI.update(jugador.rut_jugador, payload);
      showToast({ message: 'Datos del jugador actualizados.', type: 'success' });
      onSaved?.(actualizado);
      onClose();
    } catch (err) {
      showToast({ message: err.message || 'No se pudo guardar los cambios.', type: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  const renderCampo = ({ campo, etiqueta, tipo }, bloqueado) => {
    if (tipo === 'checkbox') {
      return (
        <label key={campo} className="checkbox-label-row" style={bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}>
          <input
            type="checkbox"
            checked={Boolean(valores[campo])}
            disabled={bloqueado}
            onChange={(e) => actualizarCampo(campo, e.target.checked)}
          />
          {etiqueta}
          {bloqueado && <Lock size={12} color="var(--texto-secundario)" />}
        </label>
      );
    }
    return (
      <div key={campo} className="input-group">
        <label style={{ fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {etiqueta}
          {bloqueado && <Lock size={12} color="var(--texto-secundario)" />}
        </label>
        <input
          type={tipo === 'date' ? 'date' : tipo === 'number' ? 'number' : 'text'}
          className="form-input mt-5"
          value={valores[campo] ?? ''}
          disabled={bloqueado}
          onChange={(e) => actualizarCampo(campo, e.target.value)}
          style={bloqueado ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
        />
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editar datos del jugador"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(10,15,25,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--blanco-tarjeta)', borderRadius: 'var(--radius-lg)', padding: '20px',
          maxWidth: '560px', width: '100%', maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h3 style={{ margin: 0, fontSize: '17px' }}>Datos de {jugador.nombres || 'jugador'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <p style={{ margin: '4px 0 16px', fontSize: '12px', color: 'var(--texto-secundario)' }}>
          {esAdmin
            ? 'Puedes editar todos los campos, incluyendo los administrativos.'
            : 'Revisa y completa los datos de tu jugador. Los campos con candado son administrativos y solo el club puede modificarlos.'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
          {CAMPOS_APODERADO.map((c) => renderCampo(c, false))}
        </div>

        <h4 style={{ margin: '18px 0 10px', fontSize: '13px', color: 'var(--texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Datos administrativos
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
          {CAMPOS_SOLO_ADMIN.map((c) => renderCampo(c, !esAdmin))}
        </div>

        <button
          className="btn-electric mt-20"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          onClick={guardar}
          disabled={guardando}
        >
          <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

export default EditarJugadorModal;

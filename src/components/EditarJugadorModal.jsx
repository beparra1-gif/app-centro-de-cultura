import { useState } from 'react';
import { Save, X } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';
import useModalAccesible from '../utils/useModalAccesible';
import CampoCategoria from './CampoCategoria';
import { categoriaPorNacimiento } from '../utils/categoriaPorEdad';

const SECCIONES = [
  ['personales', 'Datos personales'],
  ['fisico', 'Físico y tallas'],
  ['deportivo', 'Deportivo'],
  ['salud', 'Salud, emergencia y autorizaciones'],
];

const CAMPOS_APODERADO = [
  { seccion: 'personales', campo: 'nombres', etiqueta: 'Nombres' },
  { seccion: 'personales', campo: 'apellido_paterno', etiqueta: 'Apellido paterno' },
  { seccion: 'personales', campo: 'apellido_materno', etiqueta: 'Apellido materno' },
  { seccion: 'personales', campo: 'fecha_nacimiento', etiqueta: 'Fecha de nacimiento', tipo: 'date' },
  { seccion: 'personales', campo: 'año_nacimiento', etiqueta: 'Año de nacimiento (si no hay fecha)', tipo: 'number' },
  { seccion: 'personales', campo: 'colegio', etiqueta: 'Colegio' },
  { seccion: 'personales', campo: 'parentesco_apoderado', etiqueta: 'Parentesco del apoderado' },
  { seccion: 'deportivo', campo: 'posicion_de_juego', etiqueta: 'Posición de juego' },
  { seccion: 'fisico', campo: 'estatura', etiqueta: 'Estatura (cm)' },
  { seccion: 'fisico', campo: 'peso', etiqueta: 'Peso (kg)' },
  { seccion: 'fisico', campo: 'mano_habil', etiqueta: 'Mano hábil' },
  { seccion: 'deportivo', campo: 'club_anterior', etiqueta: 'Club anterior' },
  { seccion: 'fisico', campo: 'talla_camiseta', etiqueta: 'Talla camiseta' },
  { seccion: 'fisico', campo: 'talla_short', etiqueta: 'Talla short' },
  { seccion: 'deportivo', campo: 'foto_jugador', etiqueta: 'Foto del jugador (URL)' },
  { seccion: 'salud', campo: 'prevision', etiqueta: 'Previsión' },
  { seccion: 'salud', campo: 'tipo_sangre', etiqueta: 'Tipo de sangre' },
  { seccion: 'salud', campo: 'alergias', etiqueta: 'Alergias' },
  { seccion: 'salud', campo: 'nombre_emergencia', etiqueta: 'Nombre contacto emergencia' },
  { seccion: 'salud', campo: 'parentesco_emergencia', etiqueta: 'Parentesco contacto emergencia' },
  { seccion: 'salud', campo: 'num_emergencia', etiqueta: 'Teléfono contacto emergencia' },
  { seccion: 'salud', campo: 'derechos_imagen', etiqueta: 'Autoriza derechos de imagen', tipo: 'checkbox' },
];

// mes_inicio_cobro, beca, valor_mensualidad, exento_mensualidad y
// matricula_pagada NO viven aquí a propósito: son datos de tesorería y solo
// se editan/visualizan desde SuperAdminPanel > Usuarios y Cuentas (el
// formulario de editar jugador ahí, jugadorAdminEdit), aunque quien esté
// mirando este modal sea admin/super_admin. El backend ya los protege igual
// (stripFieldsUnlessModule, ver PUT /api/jugadores/:rut) — esto solo evita
// que existan dos lugares distintos para editar el mismo dato.
const CAMPOS_SOLO_ADMIN = [
  { campo: 'rut_apoderado', etiqueta: 'RUT apoderado (vínculo de cuenta)' },
  { campo: 'correo_apoderado', etiqueta: 'Correo apoderado' },
  { campo: 'correo_jugador', etiqueta: 'Correo del jugador' },
  { campo: 'forzar_clave_jugador', etiqueta: 'Forzar cambio de clave', tipo: 'checkbox' },
  { campo: 'rama', etiqueta: 'Rama' },
  { campo: 'categoria', etiqueta: 'Categoría' },
  { campo: 'numero_camiseta', etiqueta: 'Número camiseta' },
  { campo: 'fecha_ingreso', etiqueta: 'Fecha de ingreso', tipo: 'date' },
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
  useModalAccesible(Boolean(jugador), () => { if (!guardando) onClose?.(); });

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

  const renderCampo = ({ campo, etiqueta, tipo }) => {
    if (campo === 'categoria') {
      return (
        <CampoCategoria
          key={campo}
          id="categoria-pupilo"
          fechaNacimiento={valores.fecha_nacimiento}
          anioNacimiento={valores['año_nacimiento']}
          valor={valores.categoria}
          onCambiar={(v) => actualizarCampo('categoria', v)}
        />
      );
    }
    if (tipo === 'checkbox') {
      return (
        <label key={campo} className="checkbox-label-row">
          <input
            type="checkbox"
            checked={Boolean(valores[campo])}
            onChange={(e) => actualizarCampo(campo, e.target.checked)}
          />
          {etiqueta}
        </label>
      );
    }
    return (
      <div key={campo} className="input-group">
        <label style={{ fontSize: '12px', fontWeight: '800' }}>{etiqueta}</label>
        <input
          type={tipo === 'date' ? 'date' : tipo === 'number' ? 'number' : 'text'}
          className="form-input mt-5"
          value={valores[campo] ?? ''}
          onChange={(e) => actualizarCampo(campo, e.target.value)}
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
            : 'Aquí puedes actualizar los datos personales, físicos y deportivos de tu jugador. La categoría se asigna sola con la fecha de nacimiento; los datos de tesorería y el vínculo de cuenta los gestiona el club.'}
        </p>

        {SECCIONES.map(([clave, titulo]) => (
          <fieldset key={clave} className="uc-seccion">
            <legend>{titulo}</legend>
            {clave === 'deportivo' && !esAdmin && (
              <p className="uc-seccion-ayuda">
                Categoría: <b>{categoriaPorNacimiento(valores.fecha_nacimiento, { anioRespaldo: valores['año_nacimiento'] }) || jugador.categoria || 'sin asignar'}</b>
                {categoriaPorNacimiento(valores.fecha_nacimiento, { anioRespaldo: valores['año_nacimiento'] }) ? ' (automática por año de nacimiento)' : ''}
              </p>
            )}
            <div className="grid-auto-220">
              {CAMPOS_APODERADO.filter((c) => c.seccion === clave).map((c) => renderCampo(c))}
            </div>
          </fieldset>
        ))}

        {esAdmin && (
          <>
            <fieldset className="uc-seccion">
              <legend>Datos administrativos</legend>
              <div className="grid-auto-220">
                {CAMPOS_SOLO_ADMIN.map((c) => renderCampo(c))}
              </div>
            </fieldset>
          </>
        )}

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

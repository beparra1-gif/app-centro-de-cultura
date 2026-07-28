import { useState } from 'react';
import { ChevronRight, Eye, EyeOff, HeartPulse, Lock, User } from 'lucide-react';

function OnboardingModal({
  onboardingProgress,
  onboardingStep,
  avanzarOnboarding,
  onboardingPassword,
  onboardingPasswordConfirm,
  setOnboardingPassword,
  setOnboardingPasswordConfirm,
  onboardingCamposPendientes,
  onboardingPerfilDraft,
  setOnboardingPerfilDraft,
  onboardingSubiendoFoto,
  subirFotoOnboarding,
}) {
  const [mostrarClaveOnboarding, setMostrarClaveOnboarding] = useState(false);
  const muestraCampo = (campo) => Array.isArray(onboardingCamposPendientes) && onboardingCamposPendientes.includes(campo);

  const labelCampo = {
    nombres: 'Nombres',
    apellido_paterno: 'Apellido Paterno',
    apellido_materno: 'Apellido Materno',
    telefono: 'Telefono',
    direccion: 'Direccion',
    comuna: 'Comuna',
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card" style={{ borderRadius: '28px', boxShadow: '0 18px 44px rgba(15,23,42,0.16)', background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.96) 100%)' }}>
        <div className="progress-circle-container">
          <div className="progress-circle" style={{ background: `conic-gradient(var(--verde-victoria) ${onboardingProgress}%, #f0f0f0 ${onboardingProgress}%)` }}>
            <div className="progress-inner">{onboardingProgress}%</div>
          </div>
        </div>

        {onboardingStep === 1 && (
          <div className="step-content">
            <h3 style={{ fontWeight: '900' }}><Lock size={20} color="var(--azul-marino)" /> Clave de Seguridad</h3>
            <p>Debes cambiar tu contraseña inicial por una personal y segura para continuar.</p>
            <label htmlFor="onboarding-password-nueva" className="form-label mt-10">Nueva contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                id="onboarding-password-nueva"
                type={mostrarClaveOnboarding ? 'text' : 'password'}
                placeholder="Nueva contraseña"
                className="form-input"
                style={{ paddingRight: '40px' }}
                value={onboardingPassword}
                onChange={(e) => setOnboardingPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setMostrarClaveOnboarding((v) => !v)}
                aria-label={mostrarClaveOnboarding ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', color: 'var(--gris-secundario)' }}
              >
                {mostrarClaveOnboarding ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
              </button>
            </div>
            <label htmlFor="onboarding-password-repetir" className="form-label mt-10">Repetir contraseña</label>
            <input
              id="onboarding-password-repetir"
              type={mostrarClaveOnboarding ? 'text' : 'password'}
              placeholder="Repetir contraseña"
              className="form-input"
              value={onboardingPasswordConfirm}
              onChange={(e) => setOnboardingPasswordConfirm(e.target.value)}
            />
          </div>
        )}

        {onboardingStep === 2 && (
          <div className="step-content">
            <h3 style={{ fontWeight: '900' }}><HeartPulse size={20} color="var(--azul-marino)" /> Completar Perfil</h3>
            <p>Completa solo los datos faltantes para habilitar tu cuenta.</p>

            {Object.keys(labelCampo).map((campo) => (
              muestraCampo(campo) ? (
                <div key={campo} className="mt-10">
                  <label htmlFor={`onboarding-campo-${campo}`} className="form-label">{labelCampo[campo]}</label>
                  <input
                    id={`onboarding-campo-${campo}`}
                    type="text"
                    placeholder={labelCampo[campo]}
                    className="form-input"
                    value={onboardingPerfilDraft?.[campo] || ''}
                    onChange={(e) => setOnboardingPerfilDraft((prev) => ({ ...prev, [campo]: e.target.value }))}
                  />
                </div>
              ) : null
            ))}

            <div className="foto-upload-box mt-10" style={{ borderRadius: '22px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <User size={40} color="var(--texto-secundario)" />
              <label htmlFor="onboarding-foto-perfil">Foto de perfil (opcional). Puedes subirla ahora o despues.</label>
              <input
                id="onboarding-foto-perfil"
                type="file"
                className="form-input"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                onChange={(e) => subirFotoOnboarding(e.target.files?.[0] || null)}
              />
              {onboardingSubiendoFoto && <span style={{ fontSize: '12px' }}>Subiendo foto...</span>}
              {!onboardingSubiendoFoto && onboardingPerfilDraft?.foto_perfil_url && (
                <span style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>Foto cargada correctamente.</span>
              )}
            </div>
          </div>
        )}

        <button className="btn-electric mt-20" onClick={avanzarOnboarding} style={{ borderRadius: '18px' }}>
          {onboardingStep === 2 ? 'Guardar y continuar' : 'Siguiente Paso'} <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

export default OnboardingModal;

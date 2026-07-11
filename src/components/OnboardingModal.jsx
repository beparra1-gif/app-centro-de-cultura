import { Camera, ChevronRight, HeartPulse, Lock, User } from 'lucide-react';

function OnboardingModal({
  onboardingProgress,
  onboardingStep,
  avanzarOnboarding,
  onboardingPassword,
  onboardingPasswordConfirm,
  setOnboardingPassword,
  setOnboardingPasswordConfirm,
}) {
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
            <p>Debes cambiar tu contraseña inicial (12345) por una personal y segura para continuar.</p>
            <input
              type="password"
              placeholder="Nueva contraseña"
              className="form-input mt-10"
              value={onboardingPassword}
              onChange={(e) => setOnboardingPassword(e.target.value)}
            />
            <input
              type="password"
              placeholder="Repetir contraseña"
              className="form-input mt-10"
              value={onboardingPasswordConfirm}
              onChange={(e) => setOnboardingPasswordConfirm(e.target.value)}
            />
          </div>
        )}

        {onboardingStep === 2 && (
          <div className="step-content">
            <h3><Camera size={20} color="var(--azul-marino)" /> Foto Credencial</h3>
            <p>Sube tu imagen clara y frontal para la Tarjeta Holografica Oficial del Torneo.</p>
            <div className="foto-upload-box mt-10" style={{ borderRadius: '22px' }}>
              <User size={40} color="var(--texto-secundario)" />
              <span>Tocar para subir desde la galeria</span>
            </div>
          </div>
        )}

        {onboardingStep === 3 && (
          <div className="step-content">
            <h3 style={{ fontWeight: '900' }}><HeartPulse size={20} color="var(--azul-marino)" /> Ficha Medica Base</h3>
            <p>Completemos los datos minimos vitales para alcanzar el 70% del perfil requerido.</p>
            <input type="email" placeholder="Correo Electronico" className="form-input mt-10" />
            <input type="text" placeholder="Telefono de Emergencia" className="form-input mt-10" />
          </div>
        )}

        <button className="btn-electric mt-20" onClick={avanzarOnboarding} style={{ borderRadius: '18px' }}>
          {onboardingStep === 3 ? 'Desbloquear Acceso!' : 'Siguiente Paso'} <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

export default OnboardingModal;

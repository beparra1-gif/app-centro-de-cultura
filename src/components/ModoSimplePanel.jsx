import { useRef, useState } from 'react';
import { ArrowLeft, Camera, LogOut, Loader2, Megaphone, User } from 'lucide-react';
import * as api from '../api/client';
import { showToast } from '../utils/toast';

const MESES_ABREV = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const convertirArchivoABase64 = (archivo) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
  reader.readAsDataURL(archivo);
});

const BotonGrande = ({ icono, titulo, descripcion, onClick, color }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: '20px',
      padding: '28px 24px', borderRadius: '28px', border: 'none', cursor: 'pointer',
      background: color, color: 'white', textAlign: 'left', marginBottom: '20px',
      boxShadow: '0 10px 24px rgba(15,23,42,0.18)',
    }}
  >
    <div style={{ flexShrink: 0 }}>{icono}</div>
    <div>
      <div style={{ fontSize: '26px', fontWeight: '900', lineHeight: 1.2 }}>{titulo}</div>
      <div style={{ fontSize: '17px', fontWeight: '600', opacity: 0.92, marginTop: '4px' }}>{descripcion}</div>
    </div>
  </button>
);

const BotonVolver = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none',
      cursor: 'pointer', padding: '10px 0', marginBottom: '18px', fontSize: '20px', fontWeight: '800',
      color: 'var(--azul-electrico)',
    }}
  >
    <ArrowLeft size={26} /> Volver
  </button>
);

// Pantalla de inicio simplificada, letra grande, 3 botones: Ver Ficha, Subir
// Comprobante, Noticias — pensada para quien no está cómodo navegando la app
// completa (menús con pestañas, texto chico). Vive completamente aparte de
// las pantallas normales (ver App.jsx, modoSimpleActivo) y no las reemplaza:
// solo ofrece un camino directo a lo más usado, con menos pasos y más
// contraste. El botón "Salir del Modo Fácil" siempre está visible.
function ModoSimplePanel({ pupiloActivo, comunicaciones, usuarioAutenticado, puedeSubirComprobante, onSalir }) {
  const [vista, setVista] = useState('home');
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef(null);

  const nombrePupilo = pupiloActivo?.nombre || pupiloActivo?.nombres || 'tu jugador/a';
  const mensualidad = Number(pupiloActivo?.valor_mensualidad || 0);

  const enviarComprobanteSimple = async (archivo) => {
    if (!pupiloActivo?.rut) {
      showToast({ message: 'No encontramos a tu jugador/a asociado.', type: 'error' });
      return;
    }
    setEnviando(true);
    try {
      let comprobanteUrl = '';
      if (String(archivo.type || '').startsWith('image/')) {
        const formData = new FormData();
        formData.append('nombre', `comprobante-${pupiloActivo.rut}-${Date.now()}`);
        formData.append('tipo', 'comprobante');
        formData.append('archivo', archivo);
        const uploadRes = await api.assetsAPI.uploadLogo(formData);
        comprobanteUrl = uploadRes?.url || '';
      } else {
        comprobanteUrl = await convertirArchivoABase64(archivo);
      }

      const hoy = new Date();
      const mesTexto = MESES_ABREV[hoy.getMonth()];
      const anio = hoy.getFullYear();

      await api.pagosMensualidadesAPI.create({
        rut_jugador: pupiloActivo.rut,
        rut_pagos: usuarioAutenticado?.rut || '',
        correo_apoderado: usuarioAutenticado?.correo || pupiloActivo.correo_apoderado || '',
        concepto_pago: 'Mensualidad',
        cantidad_meses_pagados: 1,
        meses_correspondientes: `${mesTexto}-${anio}`,
        monto_total_pagado: mensualidad > 0 ? mensualidad : 0,
        comprobante_url: comprobanteUrl,
      });

      showToast({ message: 'Comprobante enviado. Tesorería lo va a revisar.', type: 'success' });
      setVista('home');
    } catch (error) {
      showToast({ message: error.message || 'No se pudo enviar el comprobante.', type: 'error' });
    } finally {
      setEnviando(false);
    }
  };


  return (
    <div style={{ padding: '20px 18px 40px', maxWidth: '560px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '30px', fontWeight: '900', color: 'var(--texto-principal)' }}>Modo Fácil</h1>
        <button
          type="button"
          onClick={onSalir}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '999px',
            border: '2px solid var(--borde-suave)', background: 'white', cursor: 'pointer',
            fontSize: '15px', fontWeight: '800', color: 'var(--texto-secundario)',
          }}
        >
          <LogOut size={18} /> Salir
        </button>
      </div>

      {vista === 'home' && (
        <>
          <p style={{ fontSize: '19px', color: 'var(--texto-secundario)', fontWeight: '700', marginBottom: '24px' }}>
            Elige qué quieres hacer:
          </p>
          <BotonGrande
            icono={<User size={44} />}
            titulo="Ver mi Ficha"
            descripcion={`Datos de ${nombrePupilo}`}
            color="linear-gradient(135deg, #0B1D3A 0%, #1B4B8F 100%)"
            onClick={() => setVista('ficha')}
          />
          {puedeSubirComprobante && (
            <BotonGrande
              icono={<Camera size={44} />}
              titulo="Subir Comprobante"
              descripcion="Enviar el pago de este mes"
              color="linear-gradient(135deg, #1D7A46 0%, #34C759 100%)"
              onClick={() => setVista('comprobante')}
            />
          )}
          <BotonGrande
            icono={<Megaphone size={44} />}
            titulo="Noticias"
            descripcion="Avisos del club"
            color="linear-gradient(135deg, #7A4B00 0%, #FF9500 100%)"
            onClick={() => setVista('noticias')}
          />
        </>
      )}

      {vista === 'ficha' && (
        <div>
          <BotonVolver onClick={() => setVista('home')} />
          {!pupiloActivo ? (
            <p style={{ fontSize: '20px', color: 'var(--texto-secundario)' }}>No encontramos datos de tu jugador/a.</p>
          ) : (
            <div style={{ background: 'white', borderRadius: '28px', padding: '28px', boxShadow: '0 10px 24px rgba(15,23,42,0.1)' }}>
              <div style={{ width: '140px', height: '140px', borderRadius: '50%', overflow: 'hidden', margin: '0 auto 20px', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {pupiloActivo.foto_jugador ? (
                  <img src={pupiloActivo.foto_jugador} alt={nombrePupilo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={64} color="#999" />
                )}
              </div>
              <h2 style={{ textAlign: 'center', fontSize: '28px', fontWeight: '900', margin: '0 0 20px' }}>{nombrePupilo}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '20px' }}>
                <div><strong>Categoría:</strong> {pupiloActivo.categoria || 'N/A'}</div>
                <div><strong>Rama:</strong> {pupiloActivo.rama || 'N/A'}</div>
                <div><strong>Nivel:</strong> {pupiloActivo.nivel || 1}</div>
                <div><strong>Estado:</strong> {pupiloActivo.estadoDeportivo || 'Activo'}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {vista === 'comprobante' && (
        <div>
          <BotonVolver onClick={() => setVista('home')} />
          <div style={{ background: 'white', borderRadius: '28px', padding: '28px', boxShadow: '0 10px 24px rgba(15,23,42,0.1)', textAlign: 'center' }}>
            <p style={{ fontSize: '20px', fontWeight: '700', marginBottom: '10px' }}>
              Mensualidad de {nombrePupilo}:
            </p>
            <p style={{ fontSize: '40px', fontWeight: '900', color: 'var(--azul-electrico)', margin: '0 0 24px' }}>
              {mensualidad > 0 ? `$${mensualidad.toLocaleString('es-CL')}` : 'Consultar monto'}
            </p>
            <p style={{ fontSize: '17px', color: 'var(--texto-secundario)', marginBottom: '24px' }}>
              Toca el botón, elige la foto del comprobante y se envía solo.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                const archivo = e.target.files?.[0] || null;
                if (archivo) void enviarComprobanteSimple(archivo);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={enviando}
              style={{
                width: '100%', padding: '24px', borderRadius: '24px', border: 'none', cursor: enviando ? 'wait' : 'pointer',
                background: 'linear-gradient(135deg, #1D7A46 0%, #34C759 100%)', color: 'white',
                fontSize: '22px', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
              }}
            >
              {enviando ? <Loader2 size={28} className="spin" /> : <Camera size={28} />}
              {enviando ? 'Enviando...' : 'Adjuntar y Enviar Comprobante'}
            </button>
            <p style={{ fontSize: '14px', color: 'var(--texto-secundario)', marginTop: '16px' }}>
              ¿Necesitas pagar más de un mes o un monto distinto? Pídele a un familiar que lo haga desde "Mi Cuenta", fuera del Modo Fácil.
            </p>
          </div>
        </div>
      )}

      {vista === 'noticias' && (
        <div>
          <BotonVolver onClick={() => setVista('home')} />
          {(!comunicaciones || comunicaciones.length === 0) ? (
            <p style={{ fontSize: '20px', color: 'var(--texto-secundario)' }}>No hay noticias por ahora.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[...comunicaciones]
                .sort((a, b) => new Date(b.FECHA || 0) - new Date(a.FECHA || 0))
                .slice(0, 15)
                .map((c, i) => (
                  <div key={c.id || i} style={{ background: 'white', borderRadius: '22px', padding: '20px', boxShadow: '0 6px 16px rgba(15,23,42,0.08)' }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: '900' }}>{c.TITULO || 'Aviso'}</h3>
                    <p style={{ margin: 0, fontSize: '18px', lineHeight: 1.5, color: 'var(--texto-secundario)' }}>{c.CUERPO_TEXTO || ''}</p>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ModoSimplePanel;

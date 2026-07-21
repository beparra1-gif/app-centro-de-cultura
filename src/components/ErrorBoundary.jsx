import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// Sin esto, cualquier excepción no controlada durante un render (un dato real
// con una forma inesperada, un campo null que no se validó, etc.) desmonta
// TODO el árbol de React y deja la pantalla en blanco sin ninguna pista de
// qué pasó — lo que los usuarios reportan como "se me cierra la pantalla".
// Con el boundary, ese mismo error queda contenido: se ve una pantalla de
// error recuperable en vez de una pantalla en blanco, y el detalle queda en
// consola para poder diagnosticarlo.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Error no controlado:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 20px',
          textAlign: 'center',
          gap: '14px',
          background: 'var(--fondo-app, #f4f6fb)',
        }}>
          <AlertTriangle size={40} color="#FF9500" />
          <h2 style={{ margin: 0, fontSize: '19px' }}>Algo salió mal</h2>
          <p style={{ margin: 0, maxWidth: '360px', fontSize: '13px', color: 'var(--texto-secundario, #6b7280)' }}>
            Ocurrió un error inesperado y esta pantalla no pudo terminar de cargar. Tus datos están a salvo — intenta recargar la página.
          </p>
          <button
            type="button"
            className="btn-electric"
            style={{ width: 'auto', padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={15} /> Recargar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

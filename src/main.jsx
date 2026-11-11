import { render } from 'preact';
import { useErrorBoundary } from 'preact/hooks';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './estilos.css';
import { App } from './app.jsx';

// Si algo falla al pintar, que no se quede la pantalla en negro sin salida.
function Seguro({ children }) {
  const [error] = useErrorBoundary();
  if (error) {
    return (
      <div class="app app--centro">
        <p class="nota">Algo ha fallado al mostrar la app.</p>
        <button type="button" class="btn" onClick={() => window.location.reload()}>Recargar</button>
      </div>
    );
  }
  return children;
}

render(<Seguro><App /></Seguro>, document.getElementById('app'));

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

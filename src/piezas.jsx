import { useEffect } from 'preact/hooks';

const TRAZOS = {
  gastar: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v9M9.5 10.2c0-1.1 1.1-1.8 2.5-1.8s2.5.7 2.5 1.8-1.1 1.6-2.5 1.8-2.5.8-2.5 1.9 1.1 1.8 2.5 1.8 2.5-.7 2.5-1.8" /></>,
  reparto: <><path d="M12 3.5v8.5h8.5" /><path d="M20.5 12A8.5 8.5 0 1 1 12 3.5" /></>,
  fijos: <><path d="M4 9.5a8 8 0 0 1 14.5-3.5M20 14.5a8 8 0 0 1-14.5 3.5" /><path d="M18.5 3v3.5H15M5.5 21v-3.5H9" /></>,
  movimientos: <><path d="M5 7h14M5 12h14M5 17h9" /></>,
  ajustes: <><circle cx="12" cy="12" r="2.8" /><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" /></>,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  hecho: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  atras: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  adelante: <path d="M9.5 5.5 16 12l-6.5 6.5" />,
};

export function Icono({ n, tam = 22 }) {
  return (
    <svg class="icono" width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {TRAZOS[n]}
    </svg>
  );
}

/** Marca de Acceler: los cinco círculos del logo. */
export function Marca({ tam = 28 }) {
  return (
    <svg width={tam} height={tam} viewBox="6 12 114 114" role="img" aria-label="Acceler">
      <circle cx="60" cy="72" r="54" fill="#7a2a2a" />
      <circle cx="76" cy="56" r="44" fill="#e8a048" />
      <circle cx="68" cy="66" r="36" fill="#c24a4a" />
      <circle cx="78" cy="60" r="26" fill="#de6262" />
      <circle cx="84" cy="56" r="15" fill="#f1b76f" />
    </svg>
  );
}

/** Panel que sube desde abajo. Se cierra con la X, tocando fuera o con Escape. */
export function Hoja({ titulo, onCerrar, children }) {
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', tecla);
    document.body.classList.add('con-hoja');
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.classList.remove('con-hoja');
    };
  }, [onCerrar]);

  return (
    <div class="velo" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div class="hoja" role="dialog" aria-modal="true" aria-label={titulo}>
        <header class="hoja__cabecera">
          <h2>{titulo}</h2>
          <button type="button" class="redondo" onClick={onCerrar} aria-label="Cerrar"><Icono n="cerrar" tam={20} /></button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Interruptor({ activo, onCambio, children, dato }) {
  return (
    <label class={`interruptor ${activo ? 'interruptor--on' : ''}`}>
      <input type="checkbox" checked={activo} onChange={(e) => onCambio(e.currentTarget.checked)} />
      <span class="interruptor__pista" aria-hidden="true"><span /></span>
      <span class="interruptor__texto">{children}</span>
      {dato != null && <span class="interruptor__dato">{dato}</span>}
    </label>
  );
}

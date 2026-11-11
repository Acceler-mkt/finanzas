import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { datos } from './datos/index.js';
import { calcular, fechaLocal, mesDe } from './logica/reparto.js';
import { aplicarPlan, planCambiarFijo, planQuitarFijo } from './logica/fijos.js';
import { Icono, Marca } from './piezas.jsx';
import { Fijos, Gastar, Movimientos, Reparto } from './vistas.jsx';
import { HojaAjustes, HojaFijo, HojaGasto, HojaIngreso, HojaMovimiento } from './hojas.jsx';

const PESTANAS = [
  { id: 'gastar', nombre: 'Gastar' },
  { id: 'reparto', nombre: 'Reparto' },
  { id: 'fijos', nombre: 'Fijos' },
  { id: 'movimientos', nombre: 'Movimientos' },
];

// Comodidades de este dispositivo (última pestaña y ámbito). Nunca datos.
const recordar = (clave) => { try { return localStorage.getItem(`finanzas-${clave}`); } catch { return null; } };
const anotar = (clave, valor) => { try { localStorage.setItem(`finanzas-${clave}`, valor); } catch { /* da igual */ } };

export function App() {
  const [fase, setFase] = useState('cargando'); // cargando · entrar · sin-acceso · listo · error
  const [usuario, setUsuario] = useState(null);
  const [ambitos, setAmbitos] = useState([]);
  const [ambitoId, setAmbitoId] = useState(null);
  const [info, setInfo] = useState(null);
  const [vista, setVista] = useState(() => (PESTANAS.some((p) => p.id === recordar('vista')) ? recordar('vista') : 'gastar'));
  const [hoja, setHoja] = useState(null);
  const [hoy, setHoy] = useState(fechaLocal());
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const arrancar = useCallback(async () => {
    try {
      const s = await datos.sesion();
      if (!s) { setFase('entrar'); return; }
      setUsuario(s.usuario);
      const lista = await datos.ambitos();
      setAmbitos(lista);
      if (!lista.length) { setFase('sin-acceso'); return; }
      const guardado = recordar('ambito');
      const id = lista.some((a) => a.id === guardado) ? guardado : lista[0].id;
      setInfo(await datos.cargar(id));
      setAmbitoId(id);
      setFase('listo');
    } catch (e) {
      setAviso(e.message);
      setFase('error');
    }
  }, []);

  useEffect(() => { arrancar(); }, [arrancar]);
  useEffect(() => datos.alCambiarSesion?.(() => { setInfo(null); setAmbitos([]); setFase('entrar'); }), []);

  const recargar = useCallback(async (id = ambitoId) => {
    const [lista, nuevo] = await Promise.all([datos.ambitos(), datos.cargar(id)]);
    setAmbitos(lista);
    setInfo(nuevo);
  }, [ambitoId]);

  // Al volver a la app: nuevo día y lo que haya apuntado el socio mientras tanto.
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return;
      setHoy(fechaLocal());
      if (fase === 'listo' && ambitoId) recargar().catch(() => {});
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [fase, ambitoId, recargar]);

  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(null), 4500);
    return () => clearTimeout(t);
  }, [aviso]);

  const hacer = async (fn) => {
    setOcupado(true);
    try {
      await fn();
      await recargar();
      setHoja(null);
    } catch (e) {
      setAviso(e.message);
    } finally {
      setOcupado(false);
    }
  };

  const cambiarAmbito = async (id) => {
    if (id === ambitoId) return;
    try {
      const nuevo = await datos.cargar(id); // se carga antes de cambiar: nunca se ven cifras de otro ámbito
      setInfo(nuevo);
      setAmbitoId(id);
      anotar('ambito', id);
    } catch (e) {
      setAviso(e.message);
    }
  };

  const irA = (id) => { setVista(id); anotar('vista', id); window.scrollTo(0, 0); };
  const cerrarHoja = useCallback(() => setHoja(null), []);

  const ambito = ambitos.find((a) => a.id === ambitoId);
  const r = useMemo(() => (ambito && info ? calcular({ ambito, ...info, hoy }) : null), [ambito, info, hoy]);

  if (fase === 'cargando') return <Pantalla><p class="nota">Cargando…</p></Pantalla>;
  if (fase === 'entrar') return <Entrar onEntrar={async (email, clave) => { await datos.entrar(email, clave); setFase('cargando'); await arrancar(); }} />;
  if (fase === 'error') return <Pantalla><p class="nota nota--falta">{aviso ?? 'No se ha podido cargar.'}</p><button class="btn" onClick={() => { setFase('cargando'); arrancar(); }}>Reintentar</button></Pantalla>;
  if (fase === 'sin-acceso') {
    return (
      <Pantalla>
        <p class="nota">Tu usuario todavía no tiene acceso a ningún ámbito.</p>
        <button class="btn" onClick={async () => { await datos.salir(); setFase('entrar'); }}>Cerrar sesión</button>
      </Pantalla>
    );
  }
  if (!r) return null;

  const mes = mesDe(hoy);

  return (
    <div class="app">
      <header class="cabecera">
        <Marca />
        {datos.esDemo && <span class="chip">Datos de prueba</span>}
        <button type="button" class="redondo cabecera__ajustes" onClick={() => setHoja({ tipo: 'ajustes' })} aria-label="Ajustes"><Icono n="ajustes" /></button>
      </header>

      {ambitos.length > 1 ? (
        <div class="ambitos" role="tablist" aria-label="Ámbito">
          {ambitos.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={a.id === ambitoId} class={a.id === ambitoId ? 'activo' : ''} onClick={() => cambiarAmbito(a.id)}>
              {a.tipo === 'sl' ? 'SL' : a.nombre}
            </button>
          ))}
        </div>
      ) : (
        <p class="eyebrow ambito-unico">{ambito.nombre}</p>
      )}

      <main key={`${ambitoId}-${vista}`} class="entrada">
        {vista === 'gastar' && <Gastar r={r} onEntra={() => setHoja({ tipo: 'ingreso' })} onGasto={() => setHoja({ tipo: 'gasto' })} />}
        {vista === 'reparto' && <Reparto r={r} ambito={ambito} onPagarImpuestos={() => setHoja({ tipo: 'gasto', esImpuestos: true })} />}
        {vista === 'fijos' && <Fijos r={r} onNuevo={() => setHoja({ tipo: 'fijo' })} onEditar={(fijo) => setHoja({ tipo: 'fijo', fijo })} />}
        {vista === 'movimientos' && <Movimientos info={info} mesHoy={mes} onAbrir={(mov) => setHoja({ tipo: 'movimiento', mov })} />}
      </main>

      <nav class="pestanas" aria-label="Secciones">
        {PESTANAS.map((p) => (
          <button key={p.id} type="button" class={vista === p.id ? 'activo' : ''} aria-current={vista === p.id ? 'page' : undefined} onClick={() => irA(p.id)}>
            <Icono n={p.id} />
            <span>{p.nombre}</span>
          </button>
        ))}
      </nav>

      {hoja?.tipo === 'ingreso' && (
        <HojaIngreso ambito={ambito} hoy={hoy} ocupado={ocupado} onCerrar={cerrarHoja} onGuardar={(f) => hacer(() => datos.nuevoIngreso(f))} />
      )}
      {hoja?.tipo === 'gasto' && (
        <HojaGasto ambito={ambito} hoy={hoy} r={r} esImpuestos={hoja.esImpuestos} ocupado={ocupado} onCerrar={cerrarHoja} onGuardar={(f) => hacer(() => datos.nuevoGasto(f))} />
      )}
      {hoja?.tipo === 'fijo' && (
        <HojaFijo
          fijo={hoja.fijo}
          ocupado={ocupado}
          onCerrar={cerrarHoja}
          onGuardar={(c) => hacer(() => (hoja.fijo
            ? aplicarPlan(datos, planCambiarFijo(hoja.fijo, c, mes))
            : datos.insertarFijo({ ...c, ambito_id: ambitoId, desde: mes, hasta: null })))}
          onQuitar={() => hacer(() => aplicarPlan(datos, planQuitarFijo(hoja.fijo, mes)))}
        />
      )}
      {hoja?.tipo === 'movimiento' && (
        <HojaMovimiento
          mov={hoja.mov}
          ocupado={ocupado}
          onCerrar={cerrarHoja}
          onBorrar={() => hacer(() => (hoja.mov.clase === 'ingreso' ? datos.borrarIngreso(hoja.mov.id) : datos.borrarGasto(hoja.mov.id)))}
        />
      )}
      {hoja?.tipo === 'ajustes' && (
        <HojaAjustes
          ambito={ambito}
          usuario={usuario}
          esDemo={datos.esDemo}
          usuarioDemo={datos.usuarioDemo?.()}
          ocupado={ocupado}
          onCerrar={cerrarHoja}
          onGuardar={(c) => hacer(() => datos.guardarAmbito(ambitoId, c))}
          onCopia={async () => { try { descargar(await datos.exportar(), hoy); } catch (e) { setAviso(e.message); } }}
          onSalir={async () => { setHoja(null); await datos.salir(); setInfo(null); setAmbitos([]); setFase('entrar'); }}
          onVerComo={(quien) => { datos.verComo(quien); setHoja(null); setFase('cargando'); arrancar(); }}
          onReiniciar={() => { datos.reiniciar(); setHoja(null); setFase('cargando'); arrancar(); }}
        />
      )}

      {aviso && <div class="aviso" role="alert">{aviso}</div>}
    </div>
  );
}

function Pantalla({ children }) {
  return <div class="app app--centro"><Marca tam={44} />{children}</div>;
}

function Entrar({ onEntrar }) {
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setOcupado(true);
    setError(null);
    try { await onEntrar(email, clave); } catch (err) { setError(err.message); setOcupado(false); }
  };

  return (
    <div class="app app--centro">
      <Marca tam={44} />
      <h1 class="pregunta">Finanzas</h1>
      <form class="entrar" onSubmit={enviar}>
        <label class="campo"><span class="eyebrow">Correo</span>
          <input type="email" autoComplete="username" required value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
        </label>
        <label class="campo"><span class="eyebrow">Contraseña</span>
          <input type="password" autoComplete="current-password" required value={clave} onInput={(e) => setClave(e.currentTarget.value)} />
        </label>
        {error && <p class="nota nota--falta" role="alert">{error}</p>}
        <button type="submit" class="btn btn--principal btn--ancho" disabled={ocupado}>Entrar</button>
      </form>
    </div>
  );
}

function descargar(contenido, hoy) {
  const blob = new Blob([JSON.stringify({ fecha: hoy, ...contenido }, null, 2)], { type: 'application/json' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `finanzas-copia-${hoy}.json`;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}

// Modo de prueba: todo vive en este dispositivo (localStorage) con cifras inventadas.
// Sirve para ver la app funcionando antes de conectar Supabase. Aquí el reparto de accesos
// es solo una imitación para poder enseñar la vista del socio; el aislamiento real lo impone
// la base de datos (supabase/01_esquema.sql) y lo comprueban los tests.

import { fechaLocal, mesAnterior, mesDe } from '../logica/reparto.js';

const CLAVE = 'finanzas-prueba-v1';

function semilla() {
  const hoy = fechaLocal();
  const mes = mesDe(hoy);
  const antes = mesAnterior(mes);
  const diaHoy = Number(hoy.slice(8));
  const d = (n) => `${mes}-${String(Math.min(n, diaHoy)).padStart(2, '0')}`;
  const p = (n) => `${antes}-${String(n).padStart(2, '0')}`;
  let n = 0;
  const id = () => `p${++n}`;
  const fijo = (ambito_id, nombre, importe, dia) => ({ id: id(), ambito_id, nombre, importe, dia, desde: antes, hasta: null });
  const ingreso = (ambito_id, fecha, importe, pct, concepto) => ({ id: id(), ambito_id, fecha, importe, impuestos: Math.round(importe * pct) / 100, concepto, creado: fecha });
  const gasto = (ambito_id, fecha, importe, concepto, tipo = 'normal') => ({ id: id(), ambito_id, fecha, importe, tipo, concepto, creado: fecha });

  return {
    usuario: 'alfonso',
    miembros: { alfonso: ['sl', 'autonomo', 'personal'], winslet: ['sl'] },
    ambitos: [
      { id: 'sl', nombre: 'Acceler SL', tipo: 'sl', pct_impuestos: 25, pct_ahorro: 20, colchon_meses: 1, orden: 1 },
      { id: 'autonomo', nombre: 'Autónomo', tipo: 'autonomo', pct_impuestos: 20, pct_ahorro: 20, colchon_meses: 1, orden: 2 },
      { id: 'personal', nombre: 'Personal', tipo: 'personal', pct_impuestos: 0, pct_ahorro: 20, colchon_meses: 1, orden: 3 },
    ],
    fijos: [
      fijo('sl', 'Herramientas y software', 320, 1),
      fijo('sl', 'Gestoría', 180, 5),
      fijo('sl', 'Seguro', 45, 20),
      fijo('autonomo', 'Gestoría', 60, 5),
      fijo('autonomo', 'Cuota de autónomos', 87, 28),
      fijo('personal', 'Alquiler', 650, 1),
      fijo('personal', 'Gimnasio', 35, 5),
      fijo('personal', 'Luz y agua', 70, 12),
      fijo('personal', 'Móvil e internet', 45, 15),
      fijo('personal', 'Suscripciones', 25, 20),
    ],
    ingresos: [
      ingreso('sl', p(4), 4200, 25, 'Cliente A'),
      ingreso('sl', p(18), 2600, 25, 'Cliente B'),
      ingreso('sl', d(3), 3500, 25, 'Cliente A'),
      ingreso('autonomo', p(6), 1800, 20, 'Factura'),
      ingreso('autonomo', d(4), 1500, 20, 'Factura'),
      ingreso('personal', p(1), 1900, 0, 'Sueldo'),
      ingreso('personal', d(1), 1900, 0, 'Sueldo'),
    ],
    gastos: [
      gasto('sl', p(12), 900, 'Anuncios'),
      gasto('sl', d(2), 240, 'Anuncios'),
      gasto('sl', d(6), 85, 'Dominio y hosting'),
      gasto('autonomo', p(15), 150, 'Material'),
      gasto('autonomo', d(5), 60, 'Material'),
      gasto('personal', p(10), 520, 'Varios'),
      gasto('personal', d(2), 86.4, 'Compra'),
      gasto('personal', d(6), 42, 'Cena'),
      gasto('personal', d(8), 50, 'Gasolina'),
    ],
  };
}

function leer() {
  try {
    const t = localStorage.getItem(CLAVE);
    if (t) return JSON.parse(t);
  } catch { /* almacenamiento bloqueado: se trabaja en memoria */ }
  return null;
}

export function crearDemo() {
  let bd = leer() ?? semilla();
  const guardar = () => {
    try { localStorage.setItem(CLAVE, JSON.stringify(bd)); } catch { /* sin almacenamiento */ }
  };
  const nuevoId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const mios = () => bd.miembros[bd.usuario] ?? [];
  const exigir = (ambitoId) => {
    if (!mios().includes(ambitoId)) throw new Error('No tienes acceso a este ámbito.');
  };
  const quitar = (lista, id) => {
    const f = bd[lista].find((x) => x.id === id);
    if (!f) return;
    exigir(f.ambito_id);
    bd[lista] = bd[lista].filter((x) => x.id !== id);
    guardar();
  };

  return {
    esDemo: true,
    async sesion() { return { usuario: { id: bd.usuario, email: `${bd.usuario} (prueba)` } }; },
    async entrar() {},
    async salir() {},
    async ambitos() {
      return bd.ambitos.filter((a) => mios().includes(a.id)).sort((x, y) => x.orden - y.orden);
    },
    async cargar(ambitoId) {
      exigir(ambitoId);
      const de = (lista) => bd[lista].filter((x) => x.ambito_id === ambitoId);
      return { ingresos: de('ingresos'), gastos: de('gastos'), fijos: de('fijos') };
    },
    async nuevoIngreso(f) { exigir(f.ambito_id); bd.ingresos.push({ ...f, id: nuevoId(), creado: new Date().toISOString() }); guardar(); },
    async borrarIngreso(id) { quitar('ingresos', id); },
    async nuevoGasto(f) { exigir(f.ambito_id); bd.gastos.push({ ...f, id: nuevoId(), creado: new Date().toISOString() }); guardar(); },
    async borrarGasto(id) { quitar('gastos', id); },
    async insertarFijo(f) { exigir(f.ambito_id); bd.fijos.push({ hasta: null, ...f, id: nuevoId() }); guardar(); },
    async actualizarFijo(id, cambios) {
      const f = bd.fijos.find((x) => x.id === id);
      if (!f) return;
      exigir(f.ambito_id);
      Object.assign(f, cambios);
      guardar();
    },
    async borrarFijo(id) { quitar('fijos', id); },
    async guardarAmbito(id, cambios) {
      exigir(id);
      Object.assign(bd.ambitos.find((a) => a.id === id), cambios);
      guardar();
    },
    async exportar() {
      const ids = mios();
      const de = (lista) => bd[lista].filter((x) => ids.includes(x.ambito_id));
      return { ambitos: bd.ambitos.filter((a) => ids.includes(a.id)), ingresos: de('ingresos'), gastos: de('gastos'), gastos_fijos: de('fijos') };
    },

    // Solo en modo de prueba
    usuarioDemo() { return bd.usuario; },
    verComo(usuario) { bd.usuario = usuario; guardar(); },
    reiniciar() { bd = semilla(); guardar(); },
  };
}

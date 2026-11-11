// Datos reales en Supabase. La app solo usa la clave pública ("anon") y la sesión del usuario:
// qué filas puede ver o tocar cada uno lo decide la base de datos (supabase/01_esquema.sql).

import { createClient } from '@supabase/supabase-js';

const MENSAJES = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/email not confirmed/i, 'Ese usuario aún no está confirmado en Supabase.'],
  [/failed to fetch|networkerror|load failed/i, 'Sin conexión. Inténtalo de nuevo.'],
  [/row-level security|permission denied/i, 'No tienes permiso para hacer eso.'],
  [/jwt expired/i, 'La sesión ha caducado. Vuelve a entrar.'],
];

function traducir(error) {
  const texto = error?.message ?? String(error);
  for (const [patron, mensaje] of MENSAJES) if (patron.test(texto)) return mensaje;
  return texto;
}

export function crearSupa(url, claveAnon) {
  const sb = createClient(url, claveAnon, { auth: { persistSession: true, autoRefreshToken: true } });

  const ok = ({ data, error }) => {
    if (error) throw new Error(traducir(error));
    return data;
  };
  const intentar = async (fn) => {
    try { return ok(await fn()); } catch (e) { throw new Error(traducir(e)); }
  };

  // La API devuelve como mucho 1.000 filas por petición: se pide por páginas hasta agotarlas.
  async function todas(tabla, filtro) {
    const filas = [];
    for (let desde = 0; ; desde += 1000) {
      let q = sb.from(tabla).select('*').order('creado', { ascending: true }).order('id').range(desde, desde + 999);
      if (filtro) q = filtro(q);
      const pagina = await intentar(() => q);
      filas.push(...pagina);
      if (pagina.length < 1000) return filas;
    }
  }

  return {
    esDemo: false,
    async sesion() {
      const { data } = await sb.auth.getSession();
      return data.session ? { usuario: { id: data.session.user.id, email: data.session.user.email } } : null;
    },
    async entrar(email, clave) {
      await intentar(() => sb.auth.signInWithPassword({ email: email.trim(), password: clave }));
    },
    async salir() { await sb.auth.signOut(); },
    alCambiarSesion(fn) {
      const { data } = sb.auth.onAuthStateChange((evento) => { if (evento === 'SIGNED_OUT') fn(); });
      return () => data.subscription.unsubscribe();
    },

    async ambitos() {
      return intentar(() => sb.from('ambitos').select('*').order('orden'));
    },
    async cargar(ambitoId) {
      const delAmbito = (q) => q.eq('ambito_id', ambitoId);
      const [ingresos, gastos, fijos] = await Promise.all([
        todas('ingresos', delAmbito), todas('gastos', delAmbito), todas('gastos_fijos', delAmbito),
      ]);
      return { ingresos, gastos, fijos };
    },

    async nuevoIngreso(f) { await intentar(() => sb.from('ingresos').insert(f)); },
    async borrarIngreso(id) { await intentar(() => sb.from('ingresos').delete().eq('id', id)); },
    async nuevoGasto(f) { await intentar(() => sb.from('gastos').insert(f)); },
    async borrarGasto(id) { await intentar(() => sb.from('gastos').delete().eq('id', id)); },
    async insertarFijo(f) { await intentar(() => sb.from('gastos_fijos').insert(f)); },
    async actualizarFijo(id, cambios) { await intentar(() => sb.from('gastos_fijos').update(cambios).eq('id', id)); },
    async borrarFijo(id) { await intentar(() => sb.from('gastos_fijos').delete().eq('id', id)); },
    async guardarAmbito(id, cambios) { await intentar(() => sb.from('ambitos').update(cambios).eq('id', id)); },

    // Copia de lo que este usuario puede ver (la base de datos ya filtra por sus ámbitos)
    async exportar() {
      const [ambitos, ingresos, gastos, gastos_fijos] = await Promise.all([
        this.ambitos(), todas('ingresos'), todas('gastos'), todas('gastos_fijos'),
      ]);
      return { ambitos, ingresos, gastos, gastos_fijos };
    },
  };
}

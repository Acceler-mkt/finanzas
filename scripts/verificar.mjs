// Comprueba, contra tu proyecto real de Supabase, que nadie sin sesión puede leer ni escribir nada.
// Usa solo la clave pública de .env.local (la misma que lleva la app). No necesita contraseñas.
//
// Uso: npm run verificar
// Después, la prueba que falta es entrar en la app con el usuario de tu socio y ver que solo aparece la SL.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { leerEntorno, TABLAS } from './entorno.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...leerEntorno(join(raiz, '.env.local')), ...process.env };
const url = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const clave = env.VITE_SUPABASE_ANON_KEY;

if (!url || !clave) {
  console.error('Falta .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Mira GUIA.pdf, paso 3.');
  process.exit(1);
}

const cabeceras = { apikey: clave, Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' };
let fallos = 0;
const linea = (bien, texto) => { if (!bien) fallos += 1; console.log(`${bien ? '  ok   ' : '  FALLO'}  ${texto}`); };

console.log(`Proyecto: ${url}\nSin iniciar sesión:`);

for (const t of TABLAS) {
  const res = await fetch(`${url}/rest/v1/${t}?select=*&limit=5`, { headers: cabeceras });
  if (res.status === 404) { linea(false, `${t}: la tabla no existe. ¿Has ejecutado supabase/01_esquema.sql?`); continue; }
  const cuerpo = await res.json().catch(() => null);
  const filas = Array.isArray(cuerpo) ? cuerpo.length : 0;
  linea(filas === 0, filas === 0 ? `${t}: no se puede leer (${res.status})` : `${t}: ¡devuelve ${filas} filas sin sesión!`);
}

const intento = await fetch(`${url}/rest/v1/ingresos`, {
  method: 'POST',
  headers: { ...cabeceras, Prefer: 'return=minimal' },
  body: JSON.stringify({ ambito_id: '00000000-0000-0000-0000-000000000000', importe: 1 }),
});
linea(!intento.ok, intento.ok ? 'ingresos: ¡se ha podido escribir sin sesión!' : `ingresos: no se puede escribir (${intento.status})`);

console.log(fallos ? `\n${fallos} comprobación(es) han fallado. No uses la app con datos reales hasta arreglarlo.` : '\nTodo cerrado para quien no ha iniciado sesión.');
process.exit(fallos ? 1 : 0);

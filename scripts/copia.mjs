// Copia de seguridad diaria de todos los datos a la carpeta "copias/" de este equipo.
// De paso mantiene despierto el proyecto gratuito de Supabase, que se pausa tras una semana sin uso.
//
// Uso: npm run copia
// Necesita un archivo ".env.copia" en la carpeta del proyecto con:
//   SUPABASE_URL=https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=la clave secreta (service_role o secret)
// Esa clave lo ve todo: se queda solo en este equipo. No es código de la app ni se publica.

import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { leerEntorno, TABLAS } from './entorno.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...leerEntorno(join(raiz, '.env.copia')), ...process.env };
const url = env.SUPABASE_URL?.replace(/\/$/, '');
const clave = env.SUPABASE_SERVICE_ROLE_KEY;
const GUARDAR = 60; // copias que se conservan

if (!url || !clave) {
  console.error('Falta .env.copia con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Mira GUIA.pdf, paso 6.');
  process.exit(1);
}

async function tabla(nombre) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const res = await fetch(`${url}/rest/v1/${nombre}?select=*`, {
      headers: { apikey: clave, Authorization: `Bearer ${clave}`, Range: `${desde}-${desde + 999}` },
    });
    if (!res.ok) throw new Error(`${nombre}: ${res.status} ${await res.text()}`);
    const pagina = await res.json();
    filas.push(...pagina);
    if (pagina.length < 1000) return filas;
  }
}

try {
  const copia = { fecha: new Date().toISOString() };
  for (const t of TABLAS) copia[t] = await tabla(t);

  const carpeta = join(raiz, 'copias');
  mkdirSync(carpeta, { recursive: true });
  const archivo = join(carpeta, `finanzas-${copia.fecha.slice(0, 10)}.json`);
  writeFileSync(archivo, JSON.stringify(copia, null, 2));

  const viejas = readdirSync(carpeta).filter((f) => /^finanzas-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().slice(0, -GUARDAR);
  for (const f of viejas) unlinkSync(join(carpeta, f));

  console.log(`Copia guardada: ${archivo}`);
  console.log(TABLAS.map((t) => `${t}: ${copia[t].length}`).join(' · '));
} catch (e) {
  console.error('La copia ha fallado:', e.message);
  process.exit(1);
}

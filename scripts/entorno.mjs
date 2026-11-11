import { existsSync, readFileSync } from 'node:fs';

/** Lee un archivo CLAVE=valor (como .env.local). Devuelve {} si no existe. */
export function leerEntorno(ruta) {
  if (!existsSync(ruta)) return {};
  const salida = {};
  for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !linea.trim().startsWith('#')) salida[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return salida;
}

export const TABLAS = ['ambitos', 'miembros', 'ingresos', 'gastos', 'gastos_fijos'];

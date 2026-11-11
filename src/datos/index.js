import { crearDemo } from './demo.js';
import { crearSupa } from './supa.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sin proyecto de Supabase configurado, la app arranca con datos de prueba.
export const datos = url && clave ? crearSupa(url, clave) : crearDemo();

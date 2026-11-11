const aFecha = (texto) => {
  const [a, m, d] = texto.split('-').map(Number);
  return new Date(a, m - 1, d || 1);
};

const fMes = new Intl.DateTimeFormat('es-ES', { month: 'long' });
const fMesAnio = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const fCorta = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

/** '2026-11' → "noviembre" */
export const nombreMes = (mes) => fMes.format(aFecha(`${mes}-01`));
/** '2026-11' → "noviembre de 2026" */
export const nombreMesAnio = (mes) => fMesAnio.format(aFecha(`${mes}-01`));
/** '2026-11-03' → "3 nov" */
export const fechaCorta = (fecha) => fCorta.format(aFecha(fecha)).replace('.', '');

export const quedan = (dias) => (dias <= 1 ? 'último día' : `quedan ${dias} días`);

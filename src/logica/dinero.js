// Todo el cálculo se hace en céntimos enteros para no arrastrar errores de decimales.

export const aCent = (euros) => Math.round(Number(euros || 0) * 100);
export const aEuros = (cent) => cent / 100;

/**
 * Lee lo que escribe una persona: "1.234,56", "1234.56", "1234,5", "1.234", "20 €".
 * Devuelve céntimos, o null si no es un importe válido mayor que cero.
 */
export function leerImporte(texto) {
  let t = String(texto ?? '').replace(/[\s€]/g, '');
  if (!t || !/^[\d.,]+$/.test(t)) return null;
  const punto = t.lastIndexOf('.');
  const coma = t.lastIndexOf(',');
  if (punto >= 0 && coma >= 0) {
    // El último de los dos es el separador decimal.
    t = coma > punto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (coma >= 0) {
    if ((t.match(/,/g) || []).length > 1) return null;
    t = t.replace(',', '.');
  } else if (punto >= 0 && /^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, ''); // "1.234" son mil doscientos treinta y cuatro
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

const conDecimales = new Intl.NumberFormat('es-ES', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always',
});
const sinDecimales = new Intl.NumberFormat('es-ES', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: 'always',
});

/** 96000 → "960 €" · 96050 → "960,50 €" */
export function euros(cent) {
  const c = Math.round(cent);
  return (c % 100 === 0 ? sinDecimales : conDecimales).format(c / 100);
}

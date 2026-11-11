import { aCent } from './dinero.js';

// Fechas como texto 'AAAA-MM-DD' y meses como 'AAAA-MM': se comparan como texto y no dependen de la zona horaria.

export const mesDe = (fecha) => fecha.slice(0, 7);

export function fechaLocal(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function mesSiguiente(mes) {
  const [a, m] = mes.split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
}

export function mesAnterior(mes) {
  const [a, m] = mes.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

export function diasDelMes(mes) {
  const [a, m] = mes.split('-').map(Number);
  return new Date(a, m, 0).getDate();
}

/** Gastos fijos vigentes en un mes: empezaron ese mes o antes y no se han dado de baja antes. */
export function fijosDelMes(fijos, mes) {
  return fijos.filter((f) => f.desde <= mes && (!f.hasta || f.hasta >= mes));
}

const sumaFijos = (fijos, mes) => fijosDelMes(fijos, mes).reduce((s, f) => s + aCent(f.importe), 0);

/**
 * El reparto de un ámbito a día de hoy. Todos los importes salen en céntimos.
 *
 * Orden del reparto de lo que entra en el mes:
 *   1. impuestos  (lo que se apartó de cada ingreso)
 *   2. fijos      (los del mes entero, hayan pasado ya o no)
 *   3. ahorro     (% de lo que queda; llena primero el colchón)
 *   4. para gastar
 *
 * Los meses cerrados dejan su resultado (lo apartado más lo no gastado, o menos lo gastado
 * de más) en una reserva. La reserva es primero colchón, hasta su objetivo, y el resto ahorro.
 */
export function calcular({ ambito, ingresos = [], gastos = [], fijos = [], hoy }) {
  const mes = mesDe(hoy);
  const dia = Number(hoy.slice(8, 10));
  const totalDias = diasDelMes(mes);
  const pctAhorro = Number(ambito?.pct_ahorro ?? 0);
  const mesesColchon = Number(ambito?.colchon_meses ?? 0);

  const porMes = new Map();
  const celda = (m) => {
    if (!porMes.has(m)) porMes.set(m, { entra: 0, impuestos: 0, gastado: 0 });
    return porMes.get(m);
  };

  let impuestosApartados = 0;
  for (const i of ingresos) {
    const m = mesDe(i.fecha);
    if (m > mes) continue; // lo fechado en meses futuros todavía no cuenta
    const c = celda(m);
    c.entra += aCent(i.importe);
    c.impuestos += aCent(i.impuestos);
    impuestosApartados += aCent(i.impuestos);
  }
  for (const g of gastos) {
    const m = mesDe(g.fecha);
    if (m > mes) continue;
    if (g.tipo === 'impuestos') impuestosApartados -= aCent(g.importe); // se paga con lo apartado
    else celda(m).gastado += aCent(g.importe);
  }
  impuestosApartados = Math.max(0, impuestosApartados);

  // Meses cerrados → reserva
  let primerMes = mes;
  for (const m of porMes.keys()) if (m < primerMes) primerMes = m;
  for (const f of fijos) if (f.desde < primerMes) primerMes = f.desde;

  let reservaCerrada = 0;
  for (let m = primerMes; m < mes; m = mesSiguiente(m)) {
    const c = porMes.get(m) ?? { entra: 0, impuestos: 0, gastado: 0 };
    reservaCerrada = Math.max(0, reservaCerrada + c.entra - c.impuestos - sumaFijos(fijos, m) - c.gastado);
  }

  // Mes en curso
  const lista = fijosDelMes(fijos, mes)
    .map((f) => {
      const diaEfectivo = Math.min(Number(f.dia), totalDias); // "día 31" en un mes de 30 es el 30
      return { ...f, cent: aCent(f.importe), diaEfectivo, pasado: diaEfectivo <= dia };
    })
    .sort((a, b) => a.diaEfectivo - b.diaEfectivo || a.nombre.localeCompare(b.nombre, 'es'));

  const fijosMes = lista.reduce((s, f) => s + f.cent, 0);
  const fijosPasados = lista.reduce((s, f) => s + (f.pasado ? f.cent : 0), 0);

  const c = porMes.get(mes) ?? { entra: 0, impuestos: 0, gastado: 0 };
  const base = c.entra - c.impuestos - fijosMes;
  const apartado = base > 0 ? Math.round((base * pctAhorro) / 100) : 0;
  const paraGastar = base - apartado;
  const disponible = paraGastar - c.gastado;

  const diasRestantes = totalDias - dia + 1; // contando hoy
  const porDia = disponible > 0 ? Math.floor(disponible / diasRestantes) : 0;

  const reserva = reservaCerrada + apartado;
  const colchonObjetivo = Math.round(fijosMes * mesesColchon);
  const colchon = Math.min(reserva, colchonObjetivo);
  const ahorro = reserva - colchon;

  // Ritmo: lo que tocaría llevar gastado hoy si se gastara igual todos los días.
  const ritmo = paraGastar > 0 ? Math.round((paraGastar * dia) / totalDias) : 0;

  let estado = 'ok';
  if (c.entra === 0) estado = 'vacio';
  else if (disponible < 0) estado = 'falta';

  return {
    mes, dia, totalDias, diasRestantes, estado,
    entra: c.entra,
    impuestosMes: c.impuestos,
    fijosMes, fijosPasados, fijosPendientes: fijosMes - fijosPasados, fijos: lista,
    apartado, paraGastar,
    gastado: c.gastado,
    disponible, porDia,
    ritmo, porEncimaDelRitmo: paraGastar > 0 && c.gastado > ritmo,
    impuestosApartados, colchon, colchonObjetivo, ahorro,
  };
}

/** Movimientos (entradas y salidas) de un mes, del más reciente al más antiguo. */
export function movimientosDelMes({ ingresos = [], gastos = [] }, mes) {
  const filas = [
    ...ingresos.filter((i) => mesDe(i.fecha) === mes).map((i) => ({ ...i, clase: 'ingreso', cent: aCent(i.importe) })),
    ...gastos.filter((g) => mesDe(g.fecha) === mes).map((g) => ({ ...g, clase: 'gasto', cent: aCent(g.importe) })),
  ];
  filas.sort((a, b) => b.fecha.localeCompare(a.fecha) || String(b.creado ?? '').localeCompare(String(a.creado ?? '')));
  return filas;
}

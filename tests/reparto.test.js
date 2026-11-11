import { describe, it, expect } from 'vitest';
import { calcular, fijosDelMes, mesAnterior, mesSiguiente, movimientosDelMes } from '../src/logica/reparto.js';
import { leerImporte, euros } from '../src/logica/dinero.js';
import { planCambiarFijo, planQuitarFijo } from '../src/logica/fijos.js';

const ambito = { pct_impuestos: 20, pct_ahorro: 20, colchon_meses: 1 };
const fijo = (nombre, importe, dia, desde = '2026-01', hasta = null) => ({ id: nombre, ambito_id: 'a', nombre, importe, dia, desde, hasta });

describe('reparto del mes', () => {
  it('el ejemplo del plan: entran 3.000, 1.200 de fijos, 20 % de impuestos y 20 % de ahorro', () => {
    const r = calcular({
      ambito,
      ingresos: [{ fecha: '2026-11-03', importe: 3000, impuestos: 600 }],
      fijos: [fijo('Alquiler', 1200, 1, '2026-11')],
      hoy: '2026-11-10',
    });
    expect(r.entra).toBe(300000);
    expect(r.impuestosMes).toBe(60000);
    expect(r.fijosMes).toBe(120000);
    expect(r.apartado).toBe(24000);
    expect(r.paraGastar).toBe(96000);
    expect(r.disponible).toBe(96000);
    expect(r.estado).toBe('ok');
    // Todo el dinero que entra queda repartido, sin céntimos sueltos
    expect(r.impuestosMes + r.fijosMes + r.apartado + r.paraGastar).toBe(r.entra);
  });

  it('cada gasto apuntado baja lo disponible, y el reparto diario cuenta desde hoy', () => {
    const r = calcular({
      ambito,
      ingresos: [{ fecha: '2026-11-03', importe: 3000, impuestos: 600 }],
      gastos: [{ fecha: '2026-11-05', importe: 60, tipo: 'normal' }, { fecha: '2026-11-08', importe: 60.5, tipo: 'normal' }],
      fijos: [fijo('Alquiler', 1200, 1, '2026-11')],
      hoy: '2026-11-10',
    });
    expect(r.gastado).toBe(12050);
    expect(r.disponible).toBe(83950);
    expect(r.diasRestantes).toBe(21);
    expect(r.porDia).toBe(Math.floor(83950 / 21));
  });

  it('los fijos que aún no han pasado ya están descontados', () => {
    const r = calcular({
      ambito: { ...ambito, pct_ahorro: 0 },
      ingresos: [{ fecha: '2026-11-01', importe: 1000, impuestos: 0 }],
      fijos: [fijo('Gimnasio', 40, 5, '2026-11'), fijo('Seguro', 100, 25, '2026-11')],
      hoy: '2026-11-10',
    });
    expect(r.fijosPasados).toBe(4000);
    expect(r.fijosPendientes).toBe(10000);
    expect(r.disponible).toBe(86000);
    expect(r.fijos.map((f) => f.pasado)).toEqual([true, false]);
  });

  it('si se gasta de más, avisa de cuánto falta', () => {
    const r = calcular({
      ambito,
      ingresos: [{ fecha: '2026-11-01', importe: 1000, impuestos: 200 }],
      gastos: [{ fecha: '2026-11-02', importe: 300, tipo: 'normal' }],
      fijos: [fijo('Alquiler', 700, 1, '2026-11')],
      hoy: '2026-11-10',
    });
    // base 100 → ahorro 20 → para gastar 80 → gastado 300
    expect(r.disponible).toBe(-22000);
    expect(r.estado).toBe('falta');
    expect(r.porDia).toBe(0);
  });

  it('si los fijos superan lo que entra, no se aparta ahorro y falta dinero', () => {
    const r = calcular({
      ambito,
      ingresos: [{ fecha: '2026-11-01', importe: 500, impuestos: 0 }],
      fijos: [fijo('Alquiler', 700, 1, '2026-11')],
      hoy: '2026-11-10',
    });
    expect(r.apartado).toBe(0);
    expect(r.disponible).toBe(-20000);
    expect(r.estado).toBe('falta');
  });

  it('sin ingresos este mes el estado es «vacío», no una alarma', () => {
    const r = calcular({ ambito, fijos: [fijo('Alquiler', 700, 1, '2026-11')], hoy: '2026-11-02' });
    expect(r.estado).toBe('vacio');
    expect(r.entra).toBe(0);
  });

  it('un fijo del día 31 se cobra el último día en los meses cortos', () => {
    const r = calcular({ ambito, fijos: [fijo('Cuota', 87, 31, '2026-11')], hoy: '2026-11-30' });
    expect(r.fijos[0].diaEfectivo).toBe(30);
    expect(r.fijos[0].pasado).toBe(true);
  });

  it('marca cuándo se va por encima del ritmo', () => {
    const base = { ambito: { ...ambito, pct_ahorro: 0 }, ingresos: [{ fecha: '2026-11-01', importe: 3000, impuestos: 0 }], hoy: '2026-11-10' };
    // Día 10 de 30: tocaría llevar gastados 1.000
    expect(calcular({ ...base, gastos: [{ fecha: '2026-11-04', importe: 900, tipo: 'normal' }] }).porEncimaDelRitmo).toBe(false);
    expect(calcular({ ...base, gastos: [{ fecha: '2026-11-04', importe: 1100, tipo: 'normal' }] }).porEncimaDelRitmo).toBe(true);
  });
});

describe('colchón, ahorro e impuestos apartados', () => {
  const fijos = [fijo('Alquiler', 1000, 1, '2026-09')];

  it('lo que sobra de los meses cerrados llena primero el colchón y después va a ahorro', () => {
    const r = calcular({
      ambito,
      ingresos: [
        { fecha: '2026-09-02', importe: 2000, impuestos: 0 },  // sept: sobran 1.000 − 400 gastados = 600
        { fecha: '2026-10-02', importe: 2500, impuestos: 0 },  // oct: sobran 1.500
        { fecha: '2026-11-02', importe: 2000, impuestos: 0 },  // nov: base 1.000 → aparta 200
      ],
      gastos: [{ fecha: '2026-09-15', importe: 400, tipo: 'normal' }],
      fijos,
      hoy: '2026-11-10',
    });
    expect(r.colchonObjetivo).toBe(100000);
    expect(r.colchon).toBe(100000);
    expect(r.ahorro).toBe(60000 + 150000 + 20000 - 100000);
    expect(r.paraGastar).toBe(80000);
  });

  it('un mes malo se come la reserva, pero nunca la deja en negativo', () => {
    const r = calcular({
      ambito,
      ingresos: [{ fecha: '2026-09-02', importe: 1300, impuestos: 0 }], // sept: +300; oct: −1.000
      fijos,
      hoy: '2026-11-10',
    });
    expect(r.colchon).toBe(0);
    expect(r.ahorro).toBe(0);
  });

  it('los impuestos se apartan de cada ingreso y bajan cuando se pagan', () => {
    const r = calcular({
      ambito,
      ingresos: [
        { fecha: '2026-09-02', importe: 2000, impuestos: 400 },
        { fecha: '2026-11-02', importe: 3000, impuestos: 600 },
      ],
      gastos: [{ fecha: '2026-10-20', importe: 350, tipo: 'impuestos' }],
      fijos: [],
      hoy: '2026-11-10',
    });
    expect(r.impuestosApartados).toBe(65000);
    // Pagar impuestos sale de lo apartado: no cuenta como gasto del mes
    expect(r.gastado).toBe(0);
  });

  it('cambiar el % de ahorro no reescribe los meses ya cerrados', () => {
    const datos = {
      ingresos: [{ fecha: '2026-10-02', importe: 2000, impuestos: 0 }],
      gastos: [{ fecha: '2026-10-10', importe: 300, tipo: 'normal' }],
      fijos: [fijo('Alquiler', 1000, 1, '2026-10')],
      hoy: '2026-11-10',
    };
    const a = calcular({ ...datos, ambito: { ...ambito, pct_ahorro: 10 } });
    const b = calcular({ ...datos, ambito: { ...ambito, pct_ahorro: 50 } });
    expect(a.colchon + a.ahorro).toBe(70000);
    expect(b.colchon + b.ahorro).toBe(70000);
  });
});

describe('gastos fijos en el tiempo', () => {
  it('solo cuentan entre su mes de alta y su mes de baja', () => {
    const fijos = [fijo('A', 10, 1, '2026-03', '2026-06'), fijo('B', 20, 1, '2026-07')];
    expect(fijosDelMes(fijos, '2026-02').length).toBe(0);
    expect(fijosDelMes(fijos, '2026-06').map((f) => f.nombre)).toEqual(['A']);
    expect(fijosDelMes(fijos, '2026-07').map((f) => f.nombre)).toEqual(['B']);
  });

  it('cambiar el importe de un fijo antiguo lo cierra el mes pasado y abre uno nuevo este mes', () => {
    const plan = planCambiarFijo(fijo('Alquiler', 650, 1, '2026-03'), { importe: 700 }, '2026-11');
    expect(plan).toEqual([
      { op: 'actualizar', id: 'Alquiler', cambios: { hasta: '2026-10' } },
      { op: 'insertar', fila: { ambito_id: 'a', nombre: 'Alquiler', importe: 700, dia: 1, desde: '2026-11', hasta: null } },
    ]);
  });

  it('cambiar solo el nombre o el día, o un fijo creado este mes, se edita sin más', () => {
    expect(planCambiarFijo(fijo('Gim', 35, 5, '2026-03'), { nombre: 'Gimnasio', dia: 7, importe: 35 }, '2026-11')[0].op).toBe('actualizar');
    expect(planCambiarFijo(fijo('Gim', 35, 5, '2026-11'), { importe: 40 }, '2026-11')).toHaveLength(1);
  });

  it('quitar un fijo antiguo conserva su historia; uno de este mes se borra', () => {
    expect(planQuitarFijo(fijo('A', 10, 1, '2026-03'), '2026-11')).toEqual([{ op: 'actualizar', id: 'A', cambios: { hasta: '2026-10' } }]);
    expect(planQuitarFijo(fijo('A', 10, 1, '2026-11'), '2026-11')).toEqual([{ op: 'borrar', id: 'A' }]);
  });

  it('los meses saltan bien de año', () => {
    expect(mesSiguiente('2026-12')).toBe('2027-01');
    expect(mesAnterior('2027-01')).toBe('2026-12');
  });
});

describe('importes', () => {
  it('lee lo que escribe una persona', () => {
    expect(leerImporte('1.234,56')).toBe(123456);
    expect(leerImporte('1234.56')).toBe(123456);
    expect(leerImporte('1234,5')).toBe(123450);
    expect(leerImporte('1.234')).toBe(123400);
    expect(leerImporte('12.5')).toBe(1250);
    expect(leerImporte(' 20 € ')).toBe(2000);
    expect(leerImporte('1,234.50')).toBe(123450);
  });

  it('rechaza lo que no es un importe', () => {
    for (const t of ['', '0', 'abc', '-5', '1,2,3', '€']) expect(leerImporte(t)).toBeNull();
  });

  it('escribe los euros a la española', () => {
    expect(euros(96000).replace(/\s/g, ' ')).toBe('960 €');
    expect(euros(123456).replace(/\s/g, ' ')).toBe('1.234,56 €');
  });

  it('ordena los movimientos del mes del más reciente al más antiguo', () => {
    const m = movimientosDelMes({
      ingresos: [{ id: 1, fecha: '2026-11-03', importe: 100 }, { id: 2, fecha: '2026-10-30', importe: 5 }],
      gastos: [{ id: 3, fecha: '2026-11-08', importe: 20 }],
    }, '2026-11');
    expect(m.map((x) => x.id)).toEqual([3, 1]);
  });
});

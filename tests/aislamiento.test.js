// Tests del aislamiento entre usuarios.
//
// Se ejecutan contra un Postgres de verdad (PGlite) cargado con los MISMOS archivos SQL que
// se pegan en Supabase: supabase/01_esquema.sql y supabase/02_usuarios.sql. Aquí no hay app
// ni interfaz: cada prueba habla con la base de datos como lo haría alguien que llama a la API
// a mano con la sesión del socio, y comprueba que la base de datos no le da nada que no sea la SL.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sql = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

const TABLAS = ['ambitos', 'miembros', 'ingresos', 'gastos', 'gastos_fijos'];
const CON_DATOS = ['ingresos', 'gastos', 'gastos_fijos'];

let db;
const u = {};      // ids de usuario
const a = {};      // ids de ámbito
const fila = {};   // una fila de cada tabla en el ámbito personal, para atacarla por id

/** Ejecuta fn dentro de una sesión de la API: rol "authenticated" con ese usuario, o "anon". */
async function como(usuarioId, fn) {
  return db.transaction(async (tx) => {
    if (usuarioId) {
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuarioId, role: 'authenticated' })]);
      await tx.exec('set local role authenticated');
    } else {
      await tx.exec('set local role anon');
    }
    return fn(tx);
  });
}

const filas = async (tx, consulta, params = []) => (await tx.query(consulta, params)).rows;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(sql('./apoyo/supabase_simulado.sql'));
  await db.exec(sql('../supabase/01_esquema.sql'));

  for (const nombre of ['alfonso', 'winslet', 'extrano']) {
    const r = await db.query(`insert into auth.users (email) values ($1) returning id`, [`${nombre}@prueba.test`]);
    u[nombre] = r.rows[0].id;
  }

  // El mismo script que se ejecutará en Supabase, con los correos de prueba
  await db.exec(
    sql('../supabase/02_usuarios.sql')
      .replace("'TU_EMAIL'", "'alfonso@prueba.test'")
      .replace("'EMAIL_DE_WINSLET'", "'winslet@prueba.test'"),
  );

  for (const r of (await db.query(`select id, tipo from public.ambitos`)).rows) a[r.tipo] = r.id;

  // Datos en los tres ámbitos, con importes distintos para detectar cualquier fuga en las sumas
  const importes = { sl: 1000, autonomo: 2000, personal: 4000 };
  for (const tipo of Object.keys(importes)) {
    await db.query(`insert into public.ingresos (ambito_id, fecha, importe, impuestos, concepto) values ($1, '2026-11-03', $2, 0, $3)`, [a[tipo], importes[tipo], `ingreso ${tipo}`]);
    await db.query(`insert into public.gastos (ambito_id, fecha, importe, concepto) values ($1, '2026-11-05', $2, $3)`, [a[tipo], importes[tipo] / 10, `gasto ${tipo}`]);
    await db.query(`insert into public.gastos_fijos (ambito_id, nombre, importe, dia, desde) values ($1, $2, $3, 1, '2026-11')`, [a[tipo], `fijo ${tipo}`, importes[tipo] / 4]);
  }
  for (const t of CON_DATOS) {
    fila[t] = (await db.query(`select id from public.${t} where ambito_id = $1`, [a.personal])).rows[0].id;
  }
});

describe('preparación', () => {
  it('existen los tres ámbitos; Alfonso está en los tres y Winslet solo en la SL', async () => {
    expect(Object.keys(a).sort()).toEqual(['autonomo', 'personal', 'sl']);
    const m = (await db.query(`select user_id, ambito_id from public.miembros`)).rows;
    expect(m.filter((x) => x.user_id === u.alfonso)).toHaveLength(3);
    expect(m.filter((x) => x.user_id === u.winslet).map((x) => x.ambito_id)).toEqual([a.sl]);
  });

  it('todas las tablas de la app tienen las reglas activadas', async () => {
    const r = await db.query(`
      select c.relname, c.relrowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'`);
    expect(r.rows.map((x) => x.relname).sort()).toEqual([...TABLAS].sort());
    // Si algún día se añade una tabla y se olvida activar sus reglas, este test falla.
    for (const t of r.rows) expect(t.relrowsecurity, `tabla ${t.relname} sin reglas`).toBe(true);
  });

  it('el script de usuarios no se puede ejecutar dos veces', async () => {
    await expect(db.exec(sql('../supabase/02_usuarios.sql').replace("'TU_EMAIL'", "'alfonso@prueba.test'"))).rejects.toThrow(/ya están creados/);
  });
});

describe('Winslet solo ve la SL', () => {
  it('ve un único ámbito', async () => {
    const r = await como(u.winslet, (tx) => filas(tx, `select id, tipo from public.ambitos`));
    expect(r).toEqual([{ id: a.sl, tipo: 'sl' }]);
  });

  it.each(CON_DATOS)('en %s solo recibe filas de la SL', async (tabla) => {
    const r = await como(u.winslet, (tx) => filas(tx, `select ambito_id from public.${tabla}`));
    expect(r.length).toBe(1);
    expect(r.every((x) => x.ambito_id === a.sl)).toBe(true);
  });

  it.each(CON_DATOS)('en %s no encuentra nada aunque pida el ámbito ajeno a propósito', async (tabla) => {
    const r = await como(u.winslet, (tx) => filas(tx, `select * from public.${tabla} where ambito_id = any($1::uuid[])`, [[a.autonomo, a.personal]]));
    expect(r).toEqual([]);
  });

  it.each(CON_DATOS)('en %s no encuentra una fila ajena aunque sepa su id', async (tabla) => {
    const r = await como(u.winslet, (tx) => filas(tx, `select * from public.${tabla} where id = $1`, [fila[tabla]]));
    expect(r).toEqual([]);
  });

  it('las sumas y los recuentos tampoco filtran lo ajeno', async () => {
    const r = await como(u.winslet, (tx) => filas(tx, `
      select (select sum(importe) from public.ingresos)::float as ingresos,
             (select sum(importe) from public.gastos)::float as gastos,
             (select sum(importe) from public.gastos_fijos)::float as fijos,
             (select count(*) from public.ambitos)::int as ambitos`));
    expect(r[0]).toEqual({ ingresos: 1000, gastos: 100, fijos: 250, ambitos: 1 });
  });

  it('no ve los accesos de Alfonso, solo el suyo', async () => {
    const r = await como(u.winslet, (tx) => filas(tx, `select user_id, ambito_id from public.miembros`));
    expect(r).toEqual([{ user_id: u.winslet, ambito_id: a.sl }]);
  });

  it('la función de pertenencia le responde solo sobre sí mismo', async () => {
    const r = await como(u.winslet, (tx) => filas(tx, `select public.es_miembro($1) as sl, public.es_miembro($2) as personal`, [a.sl, a.personal]));
    expect(r[0]).toEqual({ sl: true, personal: false });
  });
});

describe('Winslet no puede escribir fuera de la SL', () => {
  it('no puede crear un ingreso, un gasto ni un fijo en un ámbito ajeno', async () => {
    await expect(como(u.winslet, (tx) => tx.query(`insert into public.ingresos (ambito_id, importe) values ($1, 5)`, [a.personal]))).rejects.toThrow(/row-level security/);
    await expect(como(u.winslet, (tx) => tx.query(`insert into public.gastos (ambito_id, importe) values ($1, 5)`, [a.autonomo]))).rejects.toThrow(/row-level security/);
    await expect(como(u.winslet, (tx) => tx.query(`insert into public.gastos_fijos (ambito_id, nombre, importe, dia, desde) values ($1, 'x', 5, 1, '2026-11')`, [a.personal]))).rejects.toThrow(/row-level security/);
  });

  it.each(CON_DATOS)('en %s no puede cambiar ni borrar una fila ajena', async (tabla) => {
    const cambio = await como(u.winslet, (tx) => tx.query(`update public.${tabla} set importe = 1 where id = $1`, [fila[tabla]]));
    expect(cambio.affectedRows).toBe(0);
    const borrado = await como(u.winslet, (tx) => tx.query(`delete from public.${tabla} where id = $1`, [fila[tabla]]));
    expect(borrado.affectedRows).toBe(0);
    const sigue = await db.query(`select importe::float from public.${tabla} where id = $1`, [fila[tabla]]);
    expect(sigue.rows).toHaveLength(1);
    expect(sigue.rows[0].importe).not.toBe(1);
  });

  it('un borrado o cambio masivo solo toca la SL', async () => {
    // Se hace y se deshace: la transacción se aborta al final a propósito
    const afectadas = {};
    await expect(como(u.winslet, async (tx) => {
      afectadas.update = (await tx.query(`update public.ingresos set concepto = 'x'`)).affectedRows;
      afectadas.delete = (await tx.query(`delete from public.gastos`)).affectedRows;
      throw new Error('deshacer');
    })).rejects.toThrow('deshacer');
    expect(afectadas).toEqual({ update: 1, delete: 1 });
    expect((await db.query(`select count(*)::int as n from public.gastos`)).rows[0].n).toBe(3);
  });

  it('no puede mover una fila de la SL a un ámbito ajeno', async () => {
    await expect(como(u.winslet, (tx) => tx.query(`update public.ingresos set ambito_id = $1 where ambito_id = $2`, [a.personal, a.sl]))).rejects.toThrow(/row-level security/);
  });

  it('no puede darse acceso a otro ámbito ni quitárselo a Alfonso', async () => {
    await expect(como(u.winslet, (tx) => tx.query(`insert into public.miembros (ambito_id, user_id) values ($1, $2)`, [a.personal, u.winslet]))).rejects.toThrow(/permission denied/);
    await expect(como(u.winslet, (tx) => tx.query(`update public.miembros set ambito_id = $1`, [a.personal]))).rejects.toThrow(/permission denied/);
    await expect(como(u.winslet, (tx) => tx.query(`delete from public.miembros`))).rejects.toThrow(/permission denied/);
  });

  it('no puede crear ni borrar ámbitos, ni cambiar los ajustes de uno ajeno', async () => {
    await expect(como(u.winslet, (tx) => tx.query(`insert into public.ambitos (nombre, tipo) values ('mío', 'personal')`))).rejects.toThrow(/permission denied/);
    await expect(como(u.winslet, (tx) => tx.query(`delete from public.ambitos`))).rejects.toThrow(/permission denied/);
    const r = await como(u.winslet, (tx) => tx.query(`update public.ambitos set pct_ahorro = 99 where id = $1`, [a.personal]));
    expect(r.affectedRows).toBe(0);
    expect((await db.query(`select pct_ahorro::float as p from public.ambitos where id = $1`, [a.personal])).rows[0].p).toBe(20);
  });

  it('no puede cambiar el tipo ni el orden de la SL, solo sus ajustes', async () => {
    await expect(como(u.winslet, (tx) => tx.query(`update public.ambitos set tipo = 'personal' where id = $1`, [a.sl]))).rejects.toThrow(/permission denied/);
  });
});

describe('lo que sí debe funcionar', () => {
  it('Winslet trabaja con normalidad dentro de la SL', async () => {
    const r = await como(u.winslet, async (tx) => {
      const nuevo = await tx.query(`insert into public.gastos (ambito_id, importe, concepto) values ($1, 12.5, 'dominio') returning id`, [a.sl]);
      await tx.query(`update public.gastos set importe = 13 where id = $1`, [nuevo.rows[0].id]);
      const ajuste = await tx.query(`update public.ambitos set pct_ahorro = 25 where id = $1`, [a.sl]);
      const borrado = await tx.query(`delete from public.gastos where id = $1`, [nuevo.rows[0].id]);
      await tx.query(`update public.ambitos set pct_ahorro = 20 where id = $1`, [a.sl]);
      return { ajuste: ajuste.affectedRows, borrado: borrado.affectedRows };
    });
    expect(r).toEqual({ ajuste: 1, borrado: 1 });
  });

  it('la base de datos acepta exactamente las filas que envía la app', async () => {
    // Mismas columnas que mandan src/hojas.jsx y src/app.jsx. Si el esquema y la app se
    // desajustan (una columna renombrada, un permiso de menos), este test lo detecta.
    await expect(como(u.alfonso, async (tx) => {
      await tx.query(`insert into public.ingresos (ambito_id, fecha, importe, impuestos, concepto) values ($1, $2, $3, $4, $5)`, [a.autonomo, '2026-11-10', 1500, 300, 'Factura']);
      await tx.query(`insert into public.gastos (ambito_id, fecha, importe, tipo, concepto) values ($1, $2, $3, $4, $5)`, [a.autonomo, '2026-11-10', 45.5, 'impuestos', '']);
      const f = await tx.query(`insert into public.gastos_fijos (ambito_id, nombre, importe, dia, desde, hasta) values ($1, $2, $3, $4, $5, $6) returning id`, [a.autonomo, 'Gestoría', 60, 5, '2026-11', null]);
      await tx.query(`update public.gastos_fijos set hasta = $1 where id = $2`, ['2026-10', f.rows[0].id]);
      await tx.query(`update public.gastos_fijos set nombre = $1, importe = $2, dia = $3 where id = $4`, ['Gestoría', 65, 7, f.rows[0].id]);
      await tx.query(`update public.ambitos set pct_impuestos = $1, pct_ahorro = $2, colchon_meses = $3 where id = $4`, [21, 15, 1.5, a.autonomo]);
      const leido = await tx.query(`select id, ambito_id, fecha::text, importe, impuestos, concepto, creado from public.ingresos where ambito_id = $1 order by creado, id`, [a.autonomo]);
      expect(leido.rows.length).toBe(2);
      throw new Error('deshacer');
    })).rejects.toThrow('deshacer');
  });

  it('la base de datos rechaza importes y fechas sin sentido', async () => {
    const mal = (consulta, params) => expect(como(u.alfonso, (tx) => tx.query(consulta, params))).rejects.toThrow(/check constraint/);
    await mal(`insert into public.ingresos (ambito_id, importe) values ($1, 0)`, [a.sl]);
    await mal(`insert into public.ingresos (ambito_id, importe, impuestos) values ($1, 100, 150)`, [a.sl]);
    await mal(`insert into public.gastos (ambito_id, importe, tipo) values ($1, 10, 'otro')`, [a.sl]);
    await mal(`insert into public.gastos_fijos (ambito_id, nombre, importe, dia, desde) values ($1, 'x', 10, 32, '2026-11')`, [a.sl]);
    await mal(`insert into public.gastos_fijos (ambito_id, nombre, importe, dia, desde) values ($1, 'x', 10, 1, '2026-13')`, [a.sl]);
  });

  it('Alfonso ve los tres ámbitos y todos sus datos', async () => {
    const r = await como(u.alfonso, (tx) => filas(tx, `
      select (select count(*) from public.ambitos)::int as ambitos,
             (select sum(importe) from public.ingresos)::float as ingresos,
             (select count(*) from public.gastos_fijos)::int as fijos`));
    expect(r[0]).toEqual({ ambitos: 3, ingresos: 7000, fijos: 3 });
  });

  it('Alfonso ve lo que Winslet apunta en la SL', async () => {
    const id = (await como(u.winslet, (tx) => filas(tx, `insert into public.ingresos (ambito_id, importe, concepto) values ($1, 50, 'de winslet') returning id`, [a.sl])))[0].id;
    const r = await como(u.alfonso, (tx) => filas(tx, `select concepto from public.ingresos where id = $1`, [id]));
    expect(r).toEqual([{ concepto: 'de winslet' }]);
    await db.query(`delete from public.ingresos where id = $1`, [id]);
  });
});

describe('quien no tiene acceso no ve nada', () => {
  it('un usuario con cuenta pero sin ámbitos recibe todo vacío y no puede escribir', async () => {
    for (const t of TABLAS) {
      expect(await como(u.extrano, (tx) => filas(tx, `select * from public.${t}`)), t).toEqual([]);
    }
    await expect(como(u.extrano, (tx) => tx.query(`insert into public.ingresos (ambito_id, importe) values ($1, 5)`, [a.sl]))).rejects.toThrow(/row-level security/);
  });

  it.each(TABLAS)('sin iniciar sesión, %s está cerrada del todo', async (tabla) => {
    await expect(como(null, (tx) => tx.query(`select * from public.${tabla}`))).rejects.toThrow(/permission denied/);
  });

  it('sin iniciar sesión tampoco se puede escribir ni usar la función de pertenencia', async () => {
    await expect(como(null, (tx) => tx.query(`insert into public.ingresos (ambito_id, importe) values ($1, 5)`, [a.sl]))).rejects.toThrow(/permission denied/);
    await expect(como(null, (tx) => tx.query(`select public.es_miembro($1)`, [a.sl]))).rejects.toThrow(/permission denied/);
  });
});

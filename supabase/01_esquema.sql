-- Finanzas · esquema y reglas de aislamiento
-- Se pega entero en Supabase → SQL Editor → Run. Solo una vez.
--
-- Idea central: cada fila pertenece a un ámbito (SL, autónomo, personal) y la base de datos
-- solo entrega, deja crear, cambiar o borrar filas de los ámbitos de los que el usuario es miembro.
-- La app no decide nada de esto: aunque alguien llame a la API a mano, la regla es la misma.

create table public.ambitos (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  tipo          text not null check (tipo in ('sl', 'autonomo', 'personal')),
  pct_impuestos numeric(5,2) not null default 0  check (pct_impuestos between 0 and 100),
  pct_ahorro    numeric(5,2) not null default 20 check (pct_ahorro between 0 and 100),
  colchon_meses numeric(4,1) not null default 1  check (colchon_meses between 0 and 24),
  orden         int not null default 0,
  creado        timestamptz not null default now()
);

create table public.miembros (
  ambito_id uuid not null references public.ambitos (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  primary key (ambito_id, user_id)
);

create table public.ingresos (
  id        uuid primary key default gen_random_uuid(),
  ambito_id uuid not null references public.ambitos (id) on delete cascade,
  fecha     date not null default current_date,
  importe   numeric(12,2) not null check (importe > 0),
  impuestos numeric(12,2) not null default 0 check (impuestos >= 0 and impuestos <= importe),
  concepto  text not null default '',
  creado    timestamptz not null default now()
);

create table public.gastos (
  id        uuid primary key default gen_random_uuid(),
  ambito_id uuid not null references public.ambitos (id) on delete cascade,
  fecha     date not null default current_date,
  importe   numeric(12,2) not null check (importe > 0),
  tipo      text not null default 'normal' check (tipo in ('normal', 'impuestos')),
  concepto  text not null default '',
  creado    timestamptz not null default now()
);

create table public.gastos_fijos (
  id        uuid primary key default gen_random_uuid(),
  ambito_id uuid not null references public.ambitos (id) on delete cascade,
  nombre    text not null,
  importe   numeric(12,2) not null check (importe > 0),
  dia       int not null check (dia between 1 and 31),
  desde     text not null check (desde ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  hasta     text check (hasta is null or hasta ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  creado    timestamptz not null default now()
);

create index on public.miembros (user_id);
create index on public.ingresos (ambito_id, fecha);
create index on public.gastos (ambito_id, fecha);
create index on public.gastos_fijos (ambito_id);

-- ¿El usuario que hace la petición es miembro de este ámbito?
-- "security definer" para poder consultar miembros sin que su propia regla la bloquee;
-- solo responde sobre el usuario de la sesión, así que no revela nada de otros.
create function public.es_miembro(a uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.miembros m
    where m.ambito_id = a and m.user_id = (select auth.uid())
  );
$$;

-- Permisos: fuera todo lo que Supabase da por defecto y dentro solo lo necesario.
revoke all on public.ambitos, public.miembros, public.ingresos, public.gastos, public.gastos_fijos
  from public, anon, authenticated;
revoke all on function public.es_miembro(uuid) from public, anon;

grant usage on schema public to authenticated;
grant execute on function public.es_miembro(uuid) to authenticated;

grant select on public.ambitos to authenticated;
grant update (nombre, pct_impuestos, pct_ahorro, colchon_meses) on public.ambitos to authenticated;
grant select on public.miembros to authenticated;
grant select, insert, update, delete on public.ingresos, public.gastos, public.gastos_fijos to authenticated;
-- Crear ámbitos y repartir accesos no se puede desde la app: solo desde el SQL Editor (tú).

alter table public.ambitos      enable row level security;
alter table public.miembros     enable row level security;
alter table public.ingresos     enable row level security;
alter table public.gastos       enable row level security;
alter table public.gastos_fijos enable row level security;

create policy ambitos_ver on public.ambitos
  for select to authenticated
  using (public.es_miembro(id));

create policy ambitos_ajustar on public.ambitos
  for update to authenticated
  using (public.es_miembro(id))
  with check (public.es_miembro(id));

-- Cada uno ve solo sus propios accesos: el socio no sabe qué otros ámbitos existen.
create policy miembros_ver on public.miembros
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy ingresos_todo on public.ingresos
  for all to authenticated
  using (public.es_miembro(ambito_id))
  with check (public.es_miembro(ambito_id));

create policy gastos_todo on public.gastos
  for all to authenticated
  using (public.es_miembro(ambito_id))
  with check (public.es_miembro(ambito_id));

create policy fijos_todo on public.gastos_fijos
  for all to authenticated
  using (public.es_miembro(ambito_id))
  with check (public.es_miembro(ambito_id));

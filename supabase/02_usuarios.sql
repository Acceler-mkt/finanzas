-- Finanzas · crea los tres ámbitos y reparte los accesos
-- Antes: crea los dos usuarios en Supabase → Authentication → Users → Add user.
-- Después: cambia los dos correos de abajo y pulsa Run. Solo una vez.
--
-- Tú entras en los tres ámbitos. Tu socio, solo en la SL.
-- Los porcentajes son un punto de partida y se cambian luego desde la app (Ajustes).
-- El de impuestos es una estimación: confírmalo con la gestoría.

do $$
declare
  correo_mio   text := 'TU_EMAIL';
  correo_socio text := 'EMAIL_DE_WINSLET';   -- déjalo tal cual si de momento solo entras tú
  yo    uuid;
  socio uuid;
  a_sl  uuid;
  a_aut uuid;
  a_per uuid;
begin
  if exists (select 1 from public.ambitos) then
    raise exception 'Los ámbitos ya están creados. Este script solo se ejecuta una vez.';
  end if;

  select id into yo from auth.users where lower(email) = lower(correo_mio);
  if yo is null then
    raise exception 'No existe ningún usuario con el correo %. Créalo antes en Authentication → Users.', correo_mio;
  end if;
  select id into socio from auth.users where lower(email) = lower(correo_socio);

  insert into public.ambitos (nombre, tipo, pct_impuestos, pct_ahorro, colchon_meses, orden)
    values ('Acceler SL', 'sl', 25, 20, 1, 1) returning id into a_sl;
  insert into public.ambitos (nombre, tipo, pct_impuestos, pct_ahorro, colchon_meses, orden)
    values ('Autónomo', 'autonomo', 20, 20, 1, 2) returning id into a_aut;
  insert into public.ambitos (nombre, tipo, pct_impuestos, pct_ahorro, colchon_meses, orden)
    values ('Personal', 'personal', 0, 20, 1, 3) returning id into a_per;

  insert into public.miembros (ambito_id, user_id) values (a_sl, yo), (a_aut, yo), (a_per, yo);

  if socio is not null and socio <> yo then
    insert into public.miembros (ambito_id, user_id) values (a_sl, socio);
    raise notice 'Hecho: tú en los tres ámbitos y % solo en la SL.', correo_socio;
  else
    raise notice 'Hecho: tú en los tres ámbitos. Tu socio no tiene acceso todavía.';
  end if;
end $$;

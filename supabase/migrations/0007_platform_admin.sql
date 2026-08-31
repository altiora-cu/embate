-- =============================================================================
-- EMBATE — Administrador de plataforma
-- =============================================================================
-- Rol transversal para el operador de Embate: puede ver todo lo que pasa en la
-- plataforma, eliminar usuarios y comunidades, y organizar torneos sin los
-- límites del plan gratuito. Es distinto del rol `owner`/`admin` de una
-- comunidad: aquel administra SU comunidad; este opera la plataforma entera.
--
-- La lista de administradores vive en una tabla y no en un claim del JWT para
-- poder alta/baja sin re-emitir tokens. El correo fundador se promueve solo,
-- al registrarse, mediante trigger.
-- =============================================================================

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.platform_admins is
  'Operadores de la plataforma. Ven todo, moderan todo y no pagan límites de plan.';

alter table public.platform_admins enable row level security;

-- Nadie lee la lista por API salvo los propios administradores.
create policy platform_admins_select_self on public.platform_admins
  for select to authenticated
  using (user_id = auth.uid());

-- SECURITY DEFINER por el mismo motivo que is_community_admin: evita recursión
-- de políticas y deja las policies de las demás tablas en una sola llamada.
create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- Promoción automática del correo fundador
-- -----------------------------------------------------------------------------
-- Si la cuenta ya existe se promueve ahora; si todavía no, el trigger la
-- promueve en el momento del registro. Así la migración no depende del orden.

create function public.promote_founder_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) = 'christianmirabal82@gmail.com' then
    insert into public.platform_admins (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created_promote_admin
  after insert on auth.users
  for each row execute function public.promote_founder_admin();

insert into public.platform_admins (user_id)
select id from auth.users where lower(email) = 'christianmirabal82@gmail.com'
on conflict (user_id) do nothing;

-- -----------------------------------------------------------------------------
-- Lectura total de la plataforma
-- -----------------------------------------------------------------------------
-- Políticas ADITIVAS: en Postgres varias políticas permisivas se combinan con
-- OR, así que las reglas por comunidad quedan intactas y el administrador de
-- plataforma simplemente ve además todo lo demás.

create policy profiles_select_platform_admin on public.profiles
  for select to authenticated
  using (public.is_platform_admin());

create policy memberships_select_platform_admin on public.community_memberships
  for select to authenticated
  using (public.is_platform_admin());

create policy tournaments_select_platform_admin on public.tournaments
  for select to authenticated
  using (public.is_platform_admin());

create policy entries_select_platform_admin on public.tournament_entries
  for select to authenticated
  using (public.is_platform_admin());

create policy matches_select_platform_admin on public.matches
  for select to authenticated
  using (public.is_platform_admin());

create policy match_reports_select_platform_admin on public.match_reports
  for select to authenticated
  using (public.is_platform_admin());

create policy disputes_select_platform_admin on public.disputes
  for select to authenticated
  using (public.is_platform_admin());

create policy player_stats_select_platform_admin on public.player_stats
  for select to authenticated
  using (public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- Moderación: eliminar comunidades y usuarios
-- -----------------------------------------------------------------------------

create policy communities_delete_platform_admin on public.communities
  for delete to authenticated
  using (public.is_platform_admin());

-- Eliminar una comunidad completa. El CASCADE de las FK arrastra membresías,
-- torneos, partidos, reportes, disputas y estadísticas.
create function public.admin_delete_community(p_community_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  delete from public.communities where id = p_community_id;

  if not found then
    raise exception 'COMMUNITY_NOT_FOUND';
  end if;
end;
$$;

-- Eliminar una cuenta de usuario y todo lo que le pertenece.
-- Orden importa por las FK con RESTRICT:
--   1. sus comunidades (owner_id restrict) se eliminan con todo su contenido;
--   2. los torneos que creó en comunidades ajenas (created_by restrict) se
--      reasignan al dueño de esa comunidad, porque el torneo es de la comunidad
--      y no debe morir con la cuenta de quien apretó el botón;
--   3. auth.users, cuyo CASCADE arrastra perfil, membresías e inscripciones.
create function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'CANNOT_DELETE_SELF';
  end if;

  if exists (select 1 from public.platform_admins where user_id = p_user_id) then
    raise exception 'CANNOT_DELETE_ADMIN';
  end if;

  delete from public.communities where owner_id = p_user_id;

  update public.tournaments t
  set created_by = c.owner_id
  from public.communities c
  where c.id = t.community_id
    and t.created_by = p_user_id;

  delete from auth.users where id = p_user_id;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;
end;
$$;

-- Listado de cuentas para el panel. El correo vive en auth.users, que la API
-- no expone: por eso es una función con guardia y no una vista abierta.
create function public.admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  is_admin boolean,
  communities_owned int,
  memberships int,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  return query
    select
      u.id,
      u.email::text,
      coalesce(p.display_name, '')::text,
      exists (select 1 from public.platform_admins pa where pa.user_id = u.id),
      (select count(*)::int from public.communities c where c.owner_id = u.id),
      (select count(*)::int from public.community_memberships m where m.user_id = u.id),
      u.created_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- El administrador de plataforma no paga límites de plan
-- -----------------------------------------------------------------------------
-- "Organizar todos los torneos que desee": los topes comerciales del plan
-- gratuito (una comunidad por cuenta, un torneo activo por comunidad) no
-- aplican a los operadores de la plataforma.

create or replace function public.enforce_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
begin
  if exists (select 1 from public.platform_admins where user_id = new.created_by) then
    return new;
  end if;

  select plan into v_plan from public.communities where id = new.community_id;

  if v_plan = 'free'
     and new.status in ('draft', 'registration', 'in_progress')
     and public.active_tournament_count(new.community_id) >= 1 then
    raise exception 'FREE_PLAN_TOURNAMENT_LIMIT';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_free_community_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owned int;
begin
  if exists (select 1 from public.platform_admins where user_id = new.owner_id) then
    return new;
  end if;

  select count(*)::int into v_owned
  from public.communities
  where owner_id = new.owner_id and plan = 'free';

  if v_owned >= 1 then
    raise exception 'FREE_PLAN_COMMUNITY_LIMIT';
  end if;

  return new;
end;
$$;

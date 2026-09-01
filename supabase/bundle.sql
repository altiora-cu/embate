-- =============================================================================
-- EMBATE — Esquema completo
-- =============================================================================
-- ARCHIVO GENERADO. No editar a mano: los cambios se pierden.
-- Fuente: supabase/migrations/  ·  Regenerar con: npm run db:bundle
--
-- Cómo usarlo:
--   1. Abrir el proyecto en supabase.com
--   2. Ir a SQL Editor → New query
--   3. Pegar TODO este archivo y ejecutar (Run)
--
-- Contiene: 0001_init.sql, 0002_rls.sql, 0003_match_flow.sql, 0004_storage.sql, 0005_open_limits_and_public.sql, 0006_plan_limits.sql, 0007_platform_admin.sql, 0008_community_chat.sql
-- =============================================================================


-- ▼▼▼ 0001_init.sql ▼▼▼

-- =============================================================================
-- EMBATE — Esquema inicial
-- =============================================================================
-- Regla estructural del producto (§3 y §6 del paquete de dirección):
-- TODO registro de datos cuelga de una comunidad (tenant). Ninguna tabla asume
-- una sola comunidad ni un solo torneo activo. El aislamiento entre comunidades
-- se garantiza con RLS en la base, no con filtros en el código de la aplicación:
-- si un día un query olvida el `where community_id = ...`, Postgres igual no
-- devuelve datos de otra comunidad.
--
-- La cuenta de usuario es ÚNICA en toda la plataforma (auth.users de Supabase).
-- La pertenencia a comunidades es una relación aparte (community_memberships).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------

create type public.community_role as enum ('owner', 'admin', 'player');
create type public.tournament_format as enum ('league', 'cup', 'blitz');
create type public.game_mode as enum ('ultimate_team', 'kick_off');
create type public.platform as enum ('ps5', 'xbox', 'pc');
create type public.tournament_status as enum (
  'draft', 'registration', 'in_progress', 'finished', 'cancelled'
);
create type public.match_status as enum (
  'scheduled', 'awaiting_confirmation', 'confirmed', 'disputed', 'walkover'
);
create type public.match_slot as enum ('home', 'away');
create type public.dispute_status as enum ('open', 'resolved', 'rejected');

-- -----------------------------------------------------------------------------
-- profiles — datos públicos de la cuenta única de plataforma
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  -- Idioma preferido de la interfaz. Bilingüe ES/EN desde el día uno (§1).
  locale text not null default 'es' check (locale in ('es', 'en')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil de la cuenta única de plataforma. Un jugador tiene UNA cuenta para todas las comunidades.';

-- Crear el perfil automáticamente al registrarse: la app nunca debe poder
-- quedarse con un usuario autenticado y sin perfil.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1),
      'jugador'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- communities — el tenant del organizador
-- -----------------------------------------------------------------------------

-- Código de invitación legible: sin caracteres ambiguos (0/O, 1/I/L) porque
-- se dicta por voz y se copia a mano en Discord.
create function public.generate_invite_code()
returns text
language sql
volatile
as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', floor(random() * 31)::int + 1, 1),
    ''
  )
  from generate_series(1, 8);
$$;

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  name text not null check (char_length(name) between 2 and 60),
  logo_url text,
  -- White-label básico del MVP (§4, ítem 12): el organizador pone su acento.
  brand_accent text not null default '#C6FF3D'
    check (brand_accent ~* '^#[0-9a-f]{6}$'),
  default_locale text not null default 'es' check (default_locale in ('es', 'en')),
  invite_code text not null unique default public.generate_invite_code(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.communities is
  'Tenant del organizador. Una sola base de código sirve a todas: nunca se despliega una app por cliente.';

create index communities_owner_idx on public.communities (owner_id);

-- -----------------------------------------------------------------------------
-- community_memberships — relación jugador <-> comunidad
-- -----------------------------------------------------------------------------

create table public.community_memberships (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.community_role not null default 'player',
  -- Gamertag por defecto dentro de esta comunidad; se puede sobrescribir por torneo.
  gamertag text,
  platform public.platform,
  joined_at timestamptz not null default now(),
  unique (community_id, user_id)
);

create index memberships_user_idx on public.community_memberships (user_id);
create index memberships_community_idx on public.community_memberships (community_id);

-- -----------------------------------------------------------------------------
-- Helpers de autorización
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER a propósito: si estas funciones consultaran memberships bajo
-- RLS, las políticas de memberships se llamarían a sí mismas (recursión infinita).
-- Al ser definer, leen la tabla directamente y las políticas quedan simples.

create function public.is_community_member(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_memberships
    where community_id = p_community_id and user_id = auth.uid()
  );
$$;

create function public.is_community_admin(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_memberships
    where community_id = p_community_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- Los helpers que consultan `tournaments` y `matches` se definen más abajo, una
-- vez creadas esas tablas: una función en lenguaje SQL valida su cuerpo en el
-- momento del CREATE, así que declararla antes aborta la migración.

-- -----------------------------------------------------------------------------
-- tournaments
-- -----------------------------------------------------------------------------

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  format public.tournament_format not null,
  game_mode public.game_mode not null,
  -- Multi-juego preparado, no activo (§3): el campo existe y no se asume un solo título.
  game text not null default 'ea_sports_fc_26',
  -- Cupo máximo de inscritos. El Relámpago se restringe a 4/6/8 desde la app.
  size int not null check (size between 2 and 128),
  status public.tournament_status not null default 'registration',
  starts_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index tournaments_community_idx on public.tournaments (community_id, status);

-- Comunidad a la que pertenece un torneo. Se usa en las políticas de las tablas
-- que cuelgan de torneos (matches, entries) para no repetir el join.
create function public.tournament_community(p_tournament_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select community_id from public.tournaments where id = p_tournament_id;
$$;

-- -----------------------------------------------------------------------------
-- tournament_entries — inscripciones
-- -----------------------------------------------------------------------------

create table public.tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  gamertag text not null check (char_length(gamertag) between 2 and 40),
  platform public.platform not null,
  -- Siembra asignada al azar cuando el organizador cierra inscripciones (§4.4).
  seed int not null default 0,
  created_at timestamptz not null default now(),
  unique (tournament_id, user_id)
);

create index entries_tournament_idx on public.tournament_entries (tournament_id);
create index entries_user_idx on public.tournament_entries (user_id);

-- -----------------------------------------------------------------------------
-- matches
-- -----------------------------------------------------------------------------

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  round int not null check (round > 0),
  position int not null check (position > 0),
  home_entry_id uuid references public.tournament_entries (id) on delete set null,
  away_entry_id uuid references public.tournament_entries (id) on delete set null,
  home_score int check (home_score >= 0),
  away_score int check (away_score >= 0),
  status public.match_status not null default 'scheduled',
  winner_entry_id uuid references public.tournament_entries (id) on delete set null,
  -- Solo eliminación directa: a dónde avanza el ganador.
  next_match_id uuid references public.matches (id) on delete set null,
  next_slot public.match_slot,
  scheduled_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tournament_id, round, position),
  -- Nadie puede enfrentarse a sí mismo.
  constraint matches_distinct_sides check (
    home_entry_id is null or away_entry_id is null or home_entry_id <> away_entry_id
  )
);

create index matches_tournament_idx on public.matches (tournament_id, round, position);
create index matches_status_idx on public.matches (tournament_id, status);
create index matches_home_idx on public.matches (home_entry_id);
create index matches_away_idx on public.matches (away_entry_id);

-- Comunidad a la que pertenece un partido, resolviendo el join en un solo lugar.
create function public.match_community(p_match_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.community_id
  from public.matches m
  join public.tournaments t on t.id = m.tournament_id
  where m.id = p_match_id;
$$;

-- -----------------------------------------------------------------------------
-- match_reports — capturas y marcador propuesto por cada jugador (§4.5)
-- -----------------------------------------------------------------------------

create table public.match_reports (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  home_score int not null check (home_score between 0 and 99),
  away_score int not null check (away_score between 0 and 99),
  -- Ruta en Supabase Storage, aislada por comunidad (§13).
  screenshot_path text,
  created_at timestamptz not null default now()
);

create index match_reports_match_idx on public.match_reports (match_id, created_at desc);

-- -----------------------------------------------------------------------------
-- disputes (§4.6)
-- -----------------------------------------------------------------------------

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  opened_by uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 1000),
  status public.dispute_status not null default 'open',
  resolution_note text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Un partido no puede tener dos disputas abiertas a la vez.
create unique index disputes_one_open_per_match
  on public.disputes (match_id)
  where status = 'open';

create index disputes_match_idx on public.disputes (match_id);

-- -----------------------------------------------------------------------------
-- player_stats — agregados POR COMUNIDAD (§4, ítem 11: nunca global)
-- -----------------------------------------------------------------------------
-- Guarda contadores crudos, no la calificación calculada: la fórmula de las
-- 5 estrellas vive en TypeScript (src/lib/domain/rating.ts) con sus tests, y
-- duplicarla en SQL garantizaría que un día las dos versiones se separen.

create table public.player_stats (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  wins int not null default 0,
  draws int not null default 0,
  losses int not null default 0,
  goals_for int not null default 0,
  goals_against int not null default 0,
  -- Componentes de confiabilidad de la calificación de 5 estrellas (§4.1).
  matches_on_time int not null default 0,
  no_shows int not null default 0,
  disputes_total int not null default 0,
  disputes_lost int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create index player_stats_ranking_idx
  on public.player_stats (community_id, wins desc);

-- -----------------------------------------------------------------------------
-- Recálculo de estadísticas
-- -----------------------------------------------------------------------------
-- Se recalcula desde cero en vez de aplicar deltas incrementales. Un torneo tiene
-- decenas de partidos, así que el costo es irrelevante, y a cambio se elimina toda
-- una clase de bugs: si un admin corrige el marcador de un partido ya confirmado,
-- las estadísticas quedan bien sin necesidad de revertir el resultado anterior.
-- También sirve como herramienta de reparación: se puede reejecutar cuando sea.

create function public.recalc_player_stats(p_community_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wins int := 0;
  v_draws int := 0;
  v_losses int := 0;
  v_goals_for int := 0;
  v_goals_against int := 0;
  v_settled int := 0;
  v_no_shows int := 0;
  v_disputes_total int := 0;
  v_disputes_lost int := 0;
begin
  -- Partidos resueltos del jugador en esta comunidad. Se excluyen los byes
  -- (rival nulo): pasar de ronda sin jugar no es mérito ni demérito estadístico.
  with played as (
    select
      m.status,
      m.winner_entry_id,
      case when m.home_entry_id = e.id then m.home_score else m.away_score end as gf,
      case when m.home_entry_id = e.id then m.away_score else m.home_score end as ga,
      e.id as entry_id
    from public.matches m
    join public.tournaments t on t.id = m.tournament_id
    join public.tournament_entries e
      on e.id in (m.home_entry_id, m.away_entry_id)
    where t.community_id = p_community_id
      and e.user_id = p_user_id
      and m.status in ('confirmed', 'walkover')
      and m.home_entry_id is not null
      and m.away_entry_id is not null
  )
  select
    count(*) filter (where winner_entry_id = entry_id),
    count(*) filter (where status = 'confirmed' and gf is not null and gf = ga),
    count(*) filter (where winner_entry_id is not null and winner_entry_id <> entry_id),
    coalesce(sum(gf), 0),
    coalesce(sum(ga), 0),
    count(*),
    count(*) filter (
      where status = 'walkover' and winner_entry_id is not null and winner_entry_id <> entry_id
    )
  into v_wins, v_draws, v_losses, v_goals_for, v_goals_against, v_settled, v_no_shows
  from played;

  -- Comportamiento en disputas. Regla explicable: si el admin RECHAZA la disputa,
  -- la perdió quien la abrió; si la RESUELVE a favor, la perdió el rival.
  -- Las disputas todavía abiertas no puntúan en ningún sentido.
  with involved as (
    select d.status, d.opened_by, e.user_id
    from public.disputes d
    join public.matches m on m.id = d.match_id
    join public.tournaments t on t.id = m.tournament_id
    join public.tournament_entries e
      on e.id in (m.home_entry_id, m.away_entry_id)
    where t.community_id = p_community_id
      and e.user_id = p_user_id
      and d.status in ('resolved', 'rejected')
  )
  select
    count(*),
    count(*) filter (
      where (status = 'rejected' and opened_by = p_user_id)
         or (status = 'resolved' and opened_by <> p_user_id)
    )
  into v_disputes_total, v_disputes_lost
  from involved;

  insert into public.player_stats as ps (
    community_id, user_id, wins, draws, losses, goals_for, goals_against,
    matches_on_time, no_shows, disputes_total, disputes_lost, updated_at
  )
  values (
    p_community_id, p_user_id, v_wins, v_draws, v_losses, v_goals_for, v_goals_against,
    greatest(v_settled - v_no_shows, 0), v_no_shows, v_disputes_total, v_disputes_lost, now()
  )
  on conflict (community_id, user_id) do update set
    wins = excluded.wins,
    draws = excluded.draws,
    losses = excluded.losses,
    goals_for = excluded.goals_for,
    goals_against = excluded.goals_against,
    matches_on_time = excluded.matches_on_time,
    no_shows = excluded.no_shows,
    disputes_total = excluded.disputes_total,
    disputes_lost = excluded.disputes_lost,
    updated_at = now();
end;
$$;

-- Recalcula a los dos participantes de un partido.
create function public.recalc_match_participants(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_community_id uuid;
  v_user_id uuid;
begin
  select t.community_id into v_community_id
  from public.matches m
  join public.tournaments t on t.id = m.tournament_id
  where m.id = p_match_id;

  if v_community_id is null then
    return;
  end if;

  for v_user_id in
    select e.user_id
    from public.matches m
    join public.tournament_entries e on e.id in (m.home_entry_id, m.away_entry_id)
    where m.id = p_match_id
  loop
    perform public.recalc_player_stats(v_community_id, v_user_id);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Avance automático en eliminación directa + recálculo de estadísticas
-- -----------------------------------------------------------------------------

create function public.on_match_settled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- El ganador ocupa su ranura en el partido siguiente en cuanto el resultado
  -- queda en firme. Si un admin corrige un resultado, el nuevo ganador
  -- reemplaza al anterior en la misma ranura.
  if new.status in ('confirmed', 'walkover')
     and new.winner_entry_id is not null
     and new.next_match_id is not null then
    if new.next_slot = 'home' then
      update public.matches set home_entry_id = new.winner_entry_id
      where id = new.next_match_id;
    else
      update public.matches set away_entry_id = new.winner_entry_id
      where id = new.next_match_id;
    end if;
  end if;

  -- Cualquier transición desde o hacia un estado resuelto altera las estadísticas.
  if new.status in ('confirmed', 'walkover')
     or old.status in ('confirmed', 'walkover') then
    perform public.recalc_match_participants(new.id);
  end if;

  return new;
end;
$$;

create trigger matches_settled
  after update on public.matches
  for each row
  when (
    old.status is distinct from new.status
    or old.winner_entry_id is distinct from new.winner_entry_id
    or old.home_score is distinct from new.home_score
    or old.away_score is distinct from new.away_score
  )
  execute function public.on_match_settled();

-- Un bye insertado ya resuelto también debe propagar al ganador.
create function public.on_match_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'walkover'
     and new.winner_entry_id is not null
     and new.next_match_id is not null then
    if new.next_slot = 'home' then
      update public.matches set home_entry_id = new.winner_entry_id
      where id = new.next_match_id;
    else
      update public.matches set away_entry_id = new.winner_entry_id
      where id = new.next_match_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger matches_inserted
  after insert on public.matches
  for each row execute function public.on_match_inserted();

-- Resolver una disputa cambia la integridad de ambos jugadores.
create function public.on_dispute_settled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_match_participants(new.match_id);
  return new;
end;
$$;

create trigger disputes_settled
  after update on public.disputes
  for each row
  when (old.status is distinct from new.status)
  execute function public.on_dispute_settled();

-- ▲▲▲ 0001_init.sql ▲▲▲


-- ▼▼▼ 0002_rls.sql ▼▼▼

-- =============================================================================
-- EMBATE — Row Level Security
-- =============================================================================
-- El aislamiento entre comunidades se aplica acá, en la base de datos. Ninguna
-- consulta de la aplicación puede saltárselo, ni por error ni por un bug de
-- filtrado. Regla general: para ver algo de una comunidad hay que ser miembro;
-- para modificar su configuración, ser admin u owner.
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.communities enable row level security;
alter table public.community_memberships enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.matches enable row level security;
alter table public.match_reports enable row level security;
alter table public.disputes enable row level security;
alter table public.player_stats enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

-- Se ve el propio perfil y el de quien comparte alguna comunidad: sin esto no se
-- podrían mostrar los nombres de los rivales en el bracket.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.community_memberships mine
      join public.community_memberships theirs
        on theirs.community_id = mine.community_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- -----------------------------------------------------------------------------
-- communities
-- -----------------------------------------------------------------------------

-- El nombre y el slug de una comunidad no son secretos: hacen falta para la
-- pantalla de "te invitaron a X". Los datos sensibles (código de invitación,
-- torneos, jugadores) están protegidos en sus propias tablas.
create policy communities_select on public.communities
  for select to authenticated
  using (true);

create policy communities_insert on public.communities
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy communities_update_admin on public.communities
  for update to authenticated
  using (public.is_community_admin(id))
  with check (public.is_community_admin(id));

-- Borrar una comunidad es del dueño, y de nadie más.
create policy communities_delete_owner on public.communities
  for delete to authenticated
  using (owner_id = auth.uid());

-- -----------------------------------------------------------------------------
-- community_memberships
-- -----------------------------------------------------------------------------

create policy memberships_select on public.community_memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_community_member(community_id));

-- Unirse es un acto propio: nadie inscribe a otro.
create policy memberships_insert_self on public.community_memberships
  for insert to authenticated
  with check (user_id = auth.uid());

-- El jugador edita su gamertag/plataforma; el admin puede cambiar roles.
create policy memberships_update on public.community_memberships
  for update to authenticated
  using (user_id = auth.uid() or public.is_community_admin(community_id))
  with check (user_id = auth.uid() or public.is_community_admin(community_id));

-- Salirse uno mismo, o que un admin expulse.
create policy memberships_delete on public.community_memberships
  for delete to authenticated
  using (user_id = auth.uid() or public.is_community_admin(community_id));

-- -----------------------------------------------------------------------------
-- tournaments
-- -----------------------------------------------------------------------------

create policy tournaments_select on public.tournaments
  for select to authenticated
  using (public.is_community_member(community_id));

create policy tournaments_write_admin on public.tournaments
  for insert to authenticated
  with check (public.is_community_admin(community_id));

create policy tournaments_update_admin on public.tournaments
  for update to authenticated
  using (public.is_community_admin(community_id))
  with check (public.is_community_admin(community_id));

create policy tournaments_delete_admin on public.tournaments
  for delete to authenticated
  using (public.is_community_admin(community_id));

-- -----------------------------------------------------------------------------
-- tournament_entries
-- -----------------------------------------------------------------------------

create policy entries_select on public.tournament_entries
  for select to authenticated
  using (public.is_community_member(public.tournament_community(tournament_id)));

-- Solo el propio jugador se inscribe, solo si es miembro y solo mientras las
-- inscripciones estén abiertas. Que el cupo no se pase se valida acá y no en la
-- app, porque dos inscripciones simultáneas podrían burlar un chequeo en cliente.
create policy entries_insert_self on public.tournament_entries
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_community_member(public.tournament_community(tournament_id))
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.status = 'registration'
    )
  );

-- Bajarse del torneo antes de que arranque, o que el admin dé de baja a alguien.
create policy entries_delete on public.tournament_entries
  for delete to authenticated
  using (
    public.is_community_admin(public.tournament_community(tournament_id))
    or (
      user_id = auth.uid()
      and exists (
        select 1 from public.tournaments t
        where t.id = tournament_id and t.status = 'registration'
      )
    )
  );

create policy entries_update_admin on public.tournament_entries
  for update to authenticated
  using (public.is_community_admin(public.tournament_community(tournament_id)))
  with check (public.is_community_admin(public.tournament_community(tournament_id)));

-- -----------------------------------------------------------------------------
-- matches
-- -----------------------------------------------------------------------------

create policy matches_select on public.matches
  for select to authenticated
  using (public.is_community_member(public.tournament_community(tournament_id)));

-- Los cruces los crea el admin al cerrar inscripciones (§4.4).
create policy matches_insert_admin on public.matches
  for insert to authenticated
  with check (public.is_community_admin(public.tournament_community(tournament_id)));

-- Deliberadamente NO existe una política de UPDATE para jugadores.
-- Un jugador jamás escribe un marcador directamente: lo hace a través de las
-- funciones submit_match_report / confirm_match, que aplican la doble confirmación.
-- Sin esto, cualquiera podría poner "gané 5-0" con una llamada directa a la API.
create policy matches_update_admin on public.matches
  for update to authenticated
  using (public.is_community_admin(public.tournament_community(tournament_id)))
  with check (public.is_community_admin(public.tournament_community(tournament_id)));

create policy matches_delete_admin on public.matches
  for delete to authenticated
  using (public.is_community_admin(public.tournament_community(tournament_id)));

-- -----------------------------------------------------------------------------
-- match_reports — capturas subidas por los jugadores
-- -----------------------------------------------------------------------------

create policy match_reports_select on public.match_reports
  for select to authenticated
  using (public.is_community_member(public.match_community(match_id)));

-- Se insertan vía submit_match_report (SECURITY DEFINER), que además aplica el
-- límite anti-abuso. No se abre INSERT directo para evitar spam de reportes.

-- -----------------------------------------------------------------------------
-- disputes
-- -----------------------------------------------------------------------------

create policy disputes_select on public.disputes
  for select to authenticated
  using (public.is_community_member(public.match_community(match_id)));

-- Abrir y resolver disputas pasa por open_dispute / resolve_dispute.

-- -----------------------------------------------------------------------------
-- player_stats
-- -----------------------------------------------------------------------------

-- Lectura para miembros de la comunidad. El ranking "más ganador" queda así
-- acotado por comunidad por construcción (§4, ítem 11): no hay forma de leer
-- las estadísticas de una comunidad a la que no perteneces.
create policy player_stats_select on public.player_stats
  for select to authenticated
  using (public.is_community_member(community_id));

-- Sin políticas de escritura: las estadísticas solo las escriben los triggers
-- (SECURITY DEFINER). Nadie puede inflarse las victorias con un UPDATE directo.

-- ▲▲▲ 0002_rls.sql ▲▲▲


-- ▼▼▼ 0003_match_flow.sql ▼▼▼

-- =============================================================================
-- EMBATE — Flujo de resultado, doble confirmación y disputas (§4.5, §4.6)
-- =============================================================================
-- Este es el mecanismo central de confianza del producto. Toda la lógica vive en
-- funciones SECURITY DEFINER y no en el cliente, por una razón concreta: si el
-- marcador se pudiera escribir desde el navegador, cualquiera con la consola
-- abierta se pondría "gané 5-0" sin que el rival confirme nada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- El ganador se deriva del marcador, nunca se recibe del cliente
-- -----------------------------------------------------------------------------

create function public.derive_match_winner()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'confirmed'
     and new.home_score is not null
     and new.away_score is not null then
    if new.home_score > new.away_score then
      new.winner_entry_id := new.home_entry_id;
    elsif new.away_score > new.home_score then
      new.winner_entry_id := new.away_entry_id;
    else
      new.winner_entry_id := null; -- empate
    end if;
    new.confirmed_at := coalesce(new.confirmed_at, now());
  end if;
  return new;
end;
$$;

create trigger matches_derive_winner
  before insert or update on public.matches
  for each row execute function public.derive_match_winner();

-- -----------------------------------------------------------------------------
-- Helper: ¿el usuario juega este partido?
-- -----------------------------------------------------------------------------

create function public.is_match_participant(p_match_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    join public.tournament_entries e on e.id in (m.home_entry_id, m.away_entry_id)
    where m.id = p_match_id and e.user_id = p_user_id
  );
$$;

-- -----------------------------------------------------------------------------
-- Unirse a una comunidad por código de invitación
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER porque el usuario todavía no es miembro y por tanto no puede
-- leer nada de esa comunidad. Busca por código exacto y solo devuelve la
-- comunidad correspondiente: no permite enumerar comunidades ajenas.

create function public.join_community_by_code(p_code text)
returns table (community_id uuid, slug text, name text)
language plpgsql
security definer
set search_path = public
as $$
-- Las columnas de salida (`community_id`, `slug`, `name`) comparten nombre con
-- columnas reales de las tablas que toca esta función, y eso vuelve ambiguo el
-- `on conflict (community_id, user_id)` de más abajo. La directiva le dice a
-- plpgsql que ante la duda gane la columna de la tabla, que es lo que se quiere.
#variable_conflict use_column
declare
  v_community public.communities%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_community
  from public.communities
  where invite_code = upper(trim(p_code));

  if v_community.id is null then
    raise exception 'INVALID_INVITE_CODE';
  end if;

  insert into public.community_memberships (community_id, user_id, role)
  values (v_community.id, auth.uid(), 'player')
  on conflict (community_id, user_id) do nothing;

  return query select v_community.id, v_community.slug, v_community.name;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reportar resultado (§4.5)
-- -----------------------------------------------------------------------------
-- Cada jugador sube su captura y su marcador. El partido NO se confirma con un
-- solo reporte: queda "pendiente de confirmación" hasta que el rival acepte
-- (confirm_match) o cargue un marcador distinto, en cuyo caso entra en disputa
-- automáticamente y lo resuelve el admin.

-- Límite anti-abuso (§13): evita el spam de reportes contradictorios para
-- trolear el sistema de disputas.
create function public.max_reports_per_player() returns int
language sql immutable as $$ select 3 $$;

create function public.submit_match_report(
  p_match_id uuid,
  p_home_score int,
  p_away_score int,
  p_screenshot_path text default null
)
returns public.match_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_my_reports int;
  v_other public.match_reports%rowtype;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if v_match.id is null then
    raise exception 'MATCH_NOT_FOUND';
  end if;

  if not public.is_match_participant(p_match_id, v_user) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  if v_match.status not in ('scheduled', 'awaiting_confirmation') then
    raise exception 'MATCH_NOT_OPEN_FOR_REPORTS';
  end if;

  if p_home_score is null or p_away_score is null
     or p_home_score < 0 or p_away_score < 0
     or p_home_score > 99 or p_away_score > 99 then
    raise exception 'INVALID_SCORE';
  end if;

  select count(*) into v_my_reports
  from public.match_reports
  where match_id = p_match_id and reporter_id = v_user;

  if v_my_reports >= public.max_reports_per_player() then
    raise exception 'TOO_MANY_REPORTS';
  end if;

  insert into public.match_reports (
    match_id, reporter_id, home_score, away_score, screenshot_path
  )
  values (p_match_id, v_user, p_home_score, p_away_score, p_screenshot_path);

  -- Último reporte del rival, si ya cargó alguno.
  select * into v_other
  from public.match_reports
  where match_id = p_match_id and reporter_id <> v_user
  order by created_at desc
  limit 1;

  if v_other.id is null then
    -- Primer reporte: queda esperando la confirmación del rival.
    update public.matches
    set status = 'awaiting_confirmation'
    where id = p_match_id;
    return 'awaiting_confirmation';
  end if;

  if v_other.home_score = p_home_score and v_other.away_score = p_away_score then
    -- Doble confirmación conseguida: ambos cargaron el mismo marcador.
    update public.matches
    set status = 'confirmed',
        home_score = p_home_score,
        away_score = p_away_score,
        confirmed_at = now()
    where id = p_match_id;
    return 'confirmed';
  end if;

  -- Los marcadores no coinciden: el partido entra en disputa y lo resuelve el admin.
  update public.matches set status = 'disputed' where id = p_match_id;

  insert into public.disputes (match_id, opened_by, reason)
  values (
    p_match_id,
    v_user,
    format(
      'Marcadores en conflicto: %s-%s contra %s-%s.',
      v_other.home_score, v_other.away_score, p_home_score, p_away_score
    )
  )
  on conflict do nothing;

  return 'disputed';
end;
$$;

-- -----------------------------------------------------------------------------
-- Confirmar el resultado que cargó el rival
-- -----------------------------------------------------------------------------
-- Es la otra mitad de la doble confirmación: el perdedor acepta el marcador del
-- ganador sin tener que subir su propia captura.

create function public.confirm_match(p_match_id uuid)
returns public.match_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_report public.match_reports%rowtype;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if v_match.id is null then
    raise exception 'MATCH_NOT_FOUND';
  end if;

  if not public.is_match_participant(p_match_id, v_user) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  if v_match.status <> 'awaiting_confirmation' then
    raise exception 'MATCH_NOT_AWAITING_CONFIRMATION';
  end if;

  -- Solo se puede confirmar el reporte del RIVAL. Confirmar el propio reporte
  -- sería auto-adjudicarse el partido y anularía todo el mecanismo.
  select * into v_report
  from public.match_reports
  where match_id = p_match_id and reporter_id <> v_user
  order by created_at desc
  limit 1;

  if v_report.id is null then
    raise exception 'NOTHING_TO_CONFIRM';
  end if;

  update public.matches
  set status = 'confirmed',
      home_score = v_report.home_score,
      away_score = v_report.away_score,
      confirmed_at = now()
  where id = p_match_id;

  return 'confirmed';
end;
$$;

-- -----------------------------------------------------------------------------
-- Abrir disputa (§4.6)
-- -----------------------------------------------------------------------------

create function public.open_dispute(p_match_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_dispute_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if v_match.id is null then
    raise exception 'MATCH_NOT_FOUND';
  end if;

  if not public.is_match_participant(p_match_id, v_user) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  -- Un partido ya confirmado no se reabre por esta vía: eso lo decide el admin.
  if v_match.status not in ('scheduled', 'awaiting_confirmation') then
    raise exception 'MATCH_NOT_DISPUTABLE';
  end if;

  insert into public.disputes (match_id, opened_by, reason)
  values (p_match_id, v_user, trim(p_reason))
  returning id into v_dispute_id;

  update public.matches set status = 'disputed' where id = p_match_id;

  return v_dispute_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Resolver disputa — solo admin de la comunidad
-- -----------------------------------------------------------------------------
-- `p_uphold = true` significa que el admin le da la razón a quien abrió la disputa;
-- `false`, que la rechaza. Esa distinción es la que alimenta el componente de
-- integridad de la calificación de 5 estrellas (§4.1).

create function public.resolve_dispute(
  p_dispute_id uuid,
  p_home_score int,
  p_away_score int,
  p_uphold boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dispute public.disputes%rowtype;
  v_community_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_dispute from public.disputes where id = p_dispute_id for update;
  if v_dispute.id is null then
    raise exception 'DISPUTE_NOT_FOUND';
  end if;

  if v_dispute.status <> 'open' then
    raise exception 'DISPUTE_ALREADY_RESOLVED';
  end if;

  v_community_id := public.match_community(v_dispute.match_id);
  if not public.is_community_admin(v_community_id) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_home_score is null or p_away_score is null
     or p_home_score < 0 or p_away_score < 0
     or p_home_score > 99 or p_away_score > 99 then
    raise exception 'INVALID_SCORE';
  end if;

  update public.matches
  set status = 'confirmed',
      home_score = p_home_score,
      away_score = p_away_score,
      confirmed_at = now()
  where id = v_dispute.match_id;

  -- El cast explícito al enum es obligatorio: dentro de plpgsql un CASE devuelve
  -- `text` y Postgres no lo convierte solo a `dispute_status`.
  update public.disputes
  set status = (
        case when p_uphold then 'resolved' else 'rejected' end
      )::public.dispute_status,
      resolution_note = p_note,
      resolved_by = v_user,
      resolved_at = now()
  where id = p_dispute_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Adjudicar por incomparecencia — solo admin
-- -----------------------------------------------------------------------------
-- Registrar el no-show como `walkover` (y no como una derrota normal) es lo que
-- permite que la puntualidad pese en la calificación sin castigar al que sí jugó.

create function public.declare_walkover(p_match_id uuid, p_winner_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if v_match.id is null then
    raise exception 'MATCH_NOT_FOUND';
  end if;

  if not public.is_community_admin(public.match_community(p_match_id)) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_winner_entry_id not in (v_match.home_entry_id, v_match.away_entry_id) then
    raise exception 'WINNER_NOT_IN_MATCH';
  end if;

  update public.matches
  set status = 'walkover',
      winner_entry_id = p_winner_entry_id,
      home_score = null,
      away_score = null,
      confirmed_at = now()
  where id = p_match_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de ejecución
-- -----------------------------------------------------------------------------
-- Las funciones son SECURITY DEFINER: hay que ser explícito con quién puede
-- llamarlas. `anon` no puede ejecutar ninguna.

revoke all on function public.join_community_by_code(text) from public, anon;
revoke all on function public.submit_match_report(uuid, int, int, text) from public, anon;
revoke all on function public.confirm_match(uuid) from public, anon;
revoke all on function public.open_dispute(uuid, text) from public, anon;
revoke all on function public.resolve_dispute(uuid, int, int, boolean, text) from public, anon;
revoke all on function public.declare_walkover(uuid, uuid) from public, anon;
revoke all on function public.recalc_player_stats(uuid, uuid) from public, anon, authenticated;

grant execute on function public.join_community_by_code(text) to authenticated;
grant execute on function public.submit_match_report(uuid, int, int, text) to authenticated;
grant execute on function public.confirm_match(uuid) to authenticated;
grant execute on function public.open_dispute(uuid, text) to authenticated;
grant execute on function public.resolve_dispute(uuid, int, int, boolean, text) to authenticated;
grant execute on function public.declare_walkover(uuid, uuid) to authenticated;

-- ▲▲▲ 0003_match_flow.sql ▲▲▲


-- ▼▼▼ 0004_storage.sql ▼▼▼

-- =============================================================================
-- EMBATE — Almacenamiento de capturas de resultado (§13)
-- =============================================================================
-- Restricciones del paquete de dirección: JPG/PNG/WEBP, 8 MB máximo por archivo,
-- y aislamiento por comunidad. El aislamiento es lo importante: NO existe un
-- bucket compartido sin separar por comunidad. La primera carpeta de la ruta es
-- siempre el community_id, y las políticas lo verifican contra la pertenencia real.
--
-- Convención de ruta:
--   {community_id}/{tournament_id}/{match_id}/{user_id}-{timestamp}.{ext}
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'match-screenshots',
  'match-screenshots',
  false, -- privado: se sirve con URL firmada de vida corta, no con enlace público
  8388608, -- 8 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = excluded.public;

-- Ver capturas: cualquier miembro de esa comunidad. Hace falta para que el rival
-- pueda revisar la captura antes de confirmar, y para que el admin resuelva disputas.
create policy "screenshots_select_members"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'match-screenshots'
    and public.is_community_member((storage.foldername(name))[1]::uuid)
  );

-- Subir: miembro de la comunidad, y el archivo debe empezar con su propio user_id.
-- Así una captura nunca puede atribuirse a otro jugador.
create policy "screenshots_insert_members"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'match-screenshots'
    and public.is_community_member((storage.foldername(name))[1]::uuid)
    and (storage.filename(name)) like auth.uid()::text || '-%'
  );

-- Borrar: solo el admin de la comunidad. Un jugador no puede hacer desaparecer
-- la prueba de un partido en disputa.
create policy "screenshots_delete_admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'match-screenshots'
    and public.is_community_admin((storage.foldername(name))[1]::uuid)
  );

-- ▲▲▲ 0004_storage.sql ▲▲▲


-- ▼▼▼ 0005_open_limits_and_public.sql ▼▼▼

-- =============================================================================
-- EMBATE — Cupo opcional, plazo de inscripción y página pública
-- =============================================================================
-- Tres cambios pedidos por el producto:
--
-- 1. El cupo deja de ser obligatorio. Un torneo puede no tener techo de
--    jugadores; el organizador decide si pone uno y de cuánto.
-- 2. Se agrega un plazo de inscripción opcional, también a criterio del
--    organizador. Ni el cupo ni el plazo arrancan el torneo por sí solos: el
--    torneo empieza cuando el organizador cierra inscripciones y sortea.
-- 3. Una comunidad puede tener página pública de solo lectura, para que alguien
--    sin cuenta vea cómo va el torneo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 y 2 — Cupo opcional y plazo de inscripción
-- -----------------------------------------------------------------------------

alter table public.tournaments
  alter column size drop not null;

-- `null` = sin límite de jugadores. El check solo aplica cuando hay un número.
alter table public.tournaments
  drop constraint if exists tournaments_size_check;

alter table public.tournaments
  add constraint tournaments_size_check check (size is null or size >= 2);

-- Fecha límite para anotarse. Es informativa y bloquea nuevas inscripciones,
-- pero NO arranca el torneo: eso lo decide siempre una persona.
alter table public.tournaments
  add column if not exists registration_closes_at timestamptz;

comment on column public.tournaments.size is
  'Cupo máximo de jugadores. NULL = sin límite.';
comment on column public.tournaments.registration_closes_at is
  'Cierre de inscripciones. NULL = abierto hasta que el organizador lo cierre a mano.';

-- La inscripción se corta al vencer el plazo. Se aplica en la base y no solo en
-- la interfaz, porque el plazo es una regla del torneo, no una sugerencia.
drop policy if exists entries_insert_self on public.tournament_entries;

create policy entries_insert_self on public.tournament_entries
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_community_member(public.tournament_community(tournament_id))
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_id
        and t.status = 'registration'
        and (t.registration_closes_at is null or t.registration_closes_at > now())
    )
  );

-- -----------------------------------------------------------------------------
-- 3 — Página pública de la comunidad
-- -----------------------------------------------------------------------------
-- Arranca APAGADA a propósito. Encenderla expone los gamertags y los resultados
-- de esa comunidad a cualquiera con el enlace, y eso tiene que ser una decisión
-- consciente del organizador, no algo que le pase por defecto.

alter table public.communities
  add column if not exists is_public boolean not null default false;

comment on column public.communities.is_public is
  'Si está en true, cualquiera puede ver torneos y resultados sin cuenta. Nunca perfiles ni capturas.';

-- Plan de suscripción del organizador. Todavía no lo usa nada: existe desde
-- ahora para no tener que migrar datos vivos el día que se active el cobro.
alter table public.communities
  add column if not exists plan text not null default 'free'
  check (plan in ('free', 'pro'));

comment on column public.communities.plan is
  'Plan del organizador. Preparado para el cobro por suscripción; sin efecto por ahora.';

-- --- Lectura anónima, acotada a lo que se comparte -------------------------
-- Lo que un espectador sin cuenta puede ver: la comunidad, sus torneos, quién
-- juega (gamertag) y los resultados. Lo que NO: perfiles, capturas, disputas,
-- códigos de invitación de otras comunidades ni nada de comunidades privadas.

create policy communities_public_read on public.communities
  for select to anon
  using (is_public);

create policy tournaments_public_read on public.tournaments
  for select to anon
  using (
    exists (
      select 1 from public.communities c
      where c.id = community_id and c.is_public
    )
  );

create policy entries_public_read on public.tournament_entries
  for select to anon
  using (
    exists (
      select 1
      from public.tournaments t
      join public.communities c on c.id = t.community_id
      where t.id = tournament_id and c.is_public
    )
  );

create policy matches_public_read on public.matches
  for select to anon
  using (
    exists (
      select 1
      from public.tournaments t
      join public.communities c on c.id = t.community_id
      where t.id = tournament_id and c.is_public
    )
  );

-- Deliberadamente NO se abre `profiles`, `match_reports`, `disputes` ni
-- `player_stats` al rol anónimo. Las capturas son prueba de una disputa y los
-- perfiles son datos de una persona: nada de eso se comparte con un enlace.

-- ▲▲▲ 0005_open_limits_and_public.sql ▲▲▲


-- ▼▼▼ 0006_plan_limits.sql ▼▼▼

-- =============================================================================
-- EMBATE — Límite del plan gratuito
-- =============================================================================
-- Regla comercial: una comunidad en plan `free` puede tener UN torneo activo a
-- la vez. En `pro` no hay límite.
--
-- Se aplica con un trigger en la base y no en la aplicación por el mismo motivo
-- que el resto de las reglas de negocio: un chequeo en el cliente se salta con
-- una llamada directa a la API, y este en particular es el que sostiene el
-- ingreso del producto.
--
-- Mientras el cobro sea manual, el plan se cambia con `set_community_plan()`
-- desde el SQL Editor. Cuando se conecte una pasarela, el webhook llamará a esa
-- misma función y no habrá que tocar nada más.
-- =============================================================================

-- Un torneo cuenta como activo mientras no esté terminado ni cancelado.
create function public.active_tournament_count(p_community_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.tournaments
  where community_id = p_community_id
    and status in ('draft', 'registration', 'in_progress');
$$;

create function public.enforce_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
begin
  select plan into v_plan from public.communities where id = new.community_id;

  -- Solo se limita al plan gratuito, y solo al crear: un torneo ya existente
  -- nunca se bloquea, aunque la comunidad baje de plan. Cortarle un torneo en
  -- juego a los jugadores por una cuestión de facturación sería inaceptable.
  if v_plan = 'free'
     and new.status in ('draft', 'registration', 'in_progress')
     and public.active_tournament_count(new.community_id) >= 1 then
    raise exception 'FREE_PLAN_TOURNAMENT_LIMIT';
  end if;

  return new;
end;
$$;

create trigger tournaments_plan_limit
  before insert on public.tournaments
  for each row execute function public.enforce_plan_limit();

-- -----------------------------------------------------------------------------
-- Cambio de plan
-- -----------------------------------------------------------------------------
-- Pensada para ejecutarse a mano desde el SQL Editor mientras el cobro sea
-- manual. NO se expone a `authenticated`: un organizador no puede darse Pro
-- a sí mismo.
--
--   select public.set_community_plan('liga-de-los-domingos', 'pro');
--   select public.set_community_plan('liga-de-los-domingos', 'free');

create function public.set_community_plan(p_slug text, p_plan text)
returns table (slug text, name text, plan text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if p_plan not in ('free', 'pro') then
    raise exception 'INVALID_PLAN';
  end if;

  update public.communities c
  set plan = p_plan
  where c.slug = p_slug;

  if not found then
    raise exception 'COMMUNITY_NOT_FOUND';
  end if;

  return query
    select c.slug, c.name, c.plan
    from public.communities c
    where c.slug = p_slug;
end;
$$;

revoke all on function public.set_community_plan(text, text) from public, anon, authenticated;

comment on function public.set_community_plan(text, text) is
  'Cambia el plan de una comunidad. Uso manual desde el SQL Editor, o desde el webhook de la pasarela cuando exista.';

-- -----------------------------------------------------------------------------
-- Límite de comunidades gratuitas por cuenta
-- -----------------------------------------------------------------------------
-- Sin esto, el límite de "un torneo activo" no vale nada: bastaría con crear una
-- comunidad nueva por cada torneo y tener torneos gratis ilimitados con la misma
-- cuenta. El tope de torneos y el tope de comunidades tienen que ir juntos.
--
-- No frena a alguien decidido a crear varias cuentas de correo, y no pretende
-- hacerlo. Lo que sí hace es que el camino fácil deje de existir: para un
-- organizador con una comunidad viva, mudarse a otra cuenta significa perder el
-- historial, el ranking y tener que arrastrar a todos sus jugadores.

create function public.enforce_free_community_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owned int;
begin
  select count(*)::int into v_owned
  from public.communities
  where owner_id = new.owner_id and plan = 'free';

  if v_owned >= 1 then
    raise exception 'FREE_PLAN_COMMUNITY_LIMIT';
  end if;

  return new;
end;
$$;

create trigger communities_free_limit
  before insert on public.communities
  for each row execute function public.enforce_free_community_limit();

-- ▲▲▲ 0006_plan_limits.sql ▲▲▲


-- ▼▼▼ 0007_platform_admin.sql ▼▼▼

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

-- ▲▲▲ 0007_platform_admin.sql ▲▲▲


-- ▼▼▼ 0008_community_chat.sql ▼▼▼

-- =============================================================================
-- EMBATE — Chat interno de comunidad
-- =============================================================================
-- Un canal por comunidad, solo para miembros. El uso previsto es coordinar:
-- ponerse de acuerdo para amistosos fuera del torneo, avisar retrasos, pasar
-- el ID del juego. La invitación al partido en sí sigue mandándose desde la
-- consola (§4.7): el chat junta a las personas, el juego arma el partido.
--
-- Tiempo real vía Supabase Realtime (postgres_changes), que respeta RLS: un
-- cliente suscrito solo recibe los INSERT de comunidades donde es miembro.
-- =============================================================================

create table public.community_messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

comment on table public.community_messages is
  'Chat interno por comunidad. Miembros solamente; aislado por RLS como todo lo demás.';

create index community_messages_feed_idx
  on public.community_messages (community_id, created_at desc);

alter table public.community_messages enable row level security;

-- Leer: miembros de la comunidad, y el operador de la plataforma (moderación).
create policy community_messages_select on public.community_messages
  for select to authenticated
  using (
    public.is_community_member(community_id)
    or public.is_platform_admin()
  );

-- Escribir: solo como uno mismo y solo en comunidades propias. Nadie publica
-- a nombre de otro ni en canales ajenos.
create policy community_messages_insert on public.community_messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_community_member(community_id)
  );

-- Borrar: el autor su propio mensaje, la organización de la comunidad y el
-- operador de la plataforma. Sin UPDATE: un mensaje no se edita, se borra.
create policy community_messages_delete on public.community_messages
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_community_admin(community_id)
    or public.is_platform_admin()
  );

-- Publicación de Realtime. Guardado por si la publicación no existe (por
-- ejemplo, en el Postgres embebido de los tests).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.community_messages;
  end if;
end;
$$;

-- ▲▲▲ 0008_community_chat.sql ▲▲▲

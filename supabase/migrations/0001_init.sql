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

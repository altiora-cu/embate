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

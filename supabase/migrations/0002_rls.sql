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


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

-- =============================================================================
-- EMBATE — Vueltas de liga y cierre automático
-- =============================================================================
-- 1. `legs`: una liga puede jugarse a una vuelta (todos contra todos una vez)
--    o a dos (ida y vuelta, lados invertidos). El total de partidos sigue
--    saliendo solo de los inscritos: N jugadores → N·(N−1)/2 por vuelta.
--    En copa y relámpago la columna existe pero no aplica: una eliminatoria
--    no se repite.
--
-- 2. Cierre automático: cuando el último partido de un torneo queda en firme
--    (confirmado o walkover), el torneo pasa solo a 'finished'. El botón
--    manual "Cerrar torneo" se mantiene como salida para ligas estancadas —
--    un partido que nunca se jugó no debe congelar la coronación para siempre.
-- =============================================================================

alter table public.tournaments
  add column legs int not null default 1 check (legs between 1 and 2);

comment on column public.tournaments.legs is
  'Vueltas de la liga: 1 = solo ida, 2 = ida y vuelta. Sin efecto en eliminación directa.';

-- -----------------------------------------------------------------------------
-- Cierre automático al resolverse el último partido
-- -----------------------------------------------------------------------------
-- Trigger aparte de on_match_settled para no mezclar responsabilidades: aquel
-- propaga ganadores y recalcula estadísticas; este solo mira si queda algo por
-- jugar. Un partido disputado NO cuenta como resuelto: mientras la organización
-- no decida, el torneo sigue abierto.

create function public.maybe_finish_tournament()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.tournament_status;
  v_pending int;
begin
  if new.status not in ('confirmed', 'walkover') then
    return new;
  end if;

  select status into v_status
  from public.tournaments
  where id = new.tournament_id;

  if v_status is distinct from 'in_progress' then
    return new;
  end if;

  select count(*)::int into v_pending
  from public.matches
  where tournament_id = new.tournament_id
    and status not in ('confirmed', 'walkover');

  if v_pending = 0 then
    update public.tournaments
    set status = 'finished'
    where id = new.tournament_id;
  end if;

  return new;
end;
$$;

create trigger matches_maybe_finish
  after update on public.matches
  for each row
  when (old.status is distinct from new.status)
  execute function public.maybe_finish_tournament();

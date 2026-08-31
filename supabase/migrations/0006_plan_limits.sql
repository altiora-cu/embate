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

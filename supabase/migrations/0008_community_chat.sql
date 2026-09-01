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

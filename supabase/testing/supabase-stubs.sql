-- =============================================================================
-- Stubs de Supabase para verificar el esquema fuera de Supabase
-- =============================================================================
-- Recrean lo que un proyecto de Supabase ya trae puesto y un Postgres pelado no
-- tiene: los esquemas `auth` y `storage`, los roles a los que apuntan las
-- políticas, y las funciones auxiliares de Storage.
--
-- Imitan la FORMA, no el comportamiento. Sirven para validar que el SQL es
-- correcto y que la lógica de negocio hace lo que debe; NO sustituyen a probar
-- las políticas RLS con usuarios reales contra Supabase.
--
-- Lo usan `scripts/verify-sql.mjs` y los tests de integración de la base.
-- =============================================================================

create schema if not exists auth;
create schema if not exists storage;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
end
$$;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

/*
 * En Supabase, `auth.uid()` sale del JWT del request. Acá se lee de un ajuste de
 * sesión, para que un test pueda decir "ahora hablo como este jugador" y ejercer
 * las funciones RPC igual que lo haría el navegador.
 */
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('test.user_id', true), '')::uuid
$$;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select string_to_array(regexp_replace(name, '/[^/]*$', ''), '/')
$$;

create or replace function storage.filename(name text) returns text
language sql immutable as $$
  select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)]
$$;

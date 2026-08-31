/**
 * Verificación de las migraciones contra un Postgres real.
 *
 * Usa PGlite (Postgres compilado a WebAssembly), así que corre en Node sin
 * Docker ni servidor. El objetivo es simple: que nadie pegue en el SQL Editor de
 * Supabase un archivo que va a explotar a la mitad y deje el esquema partido.
 *
 * Antes de las migraciones se crean stubs de lo que aporta Supabase y no existe
 * en un Postgres pelado: los esquemas `auth` y `storage`, la función `auth.uid()`
 * y los roles `authenticated` y `anon`. Los stubs imitan la forma, no el
 * comportamiento — esto valida que el SQL es correcto y coherente, no que las
 * políticas RLS autoricen lo que deben (eso se prueba con datos reales).
 *
 * Uso:
 *   npm run db:verify
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = "supabase/migrations";

/** Lo que Supabase ya trae puesto en un proyecto nuevo. */
const SUPABASE_STUBS = `
create schema if not exists auth;
create schema if not exists storage;

-- Roles que Supabase crea por defecto y a los que apuntan las políticas.
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

-- En Supabase devuelve el usuario del JWT. Acá solo tiene que existir y tipar.
create or replace function auth.uid() returns uuid
language sql stable as $$ select null::uuid $$;

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
`;

const db = new PGlite();

console.log("Levantando Postgres embebido…");
await db.exec(SUPABASE_STUBS);
console.log("✓ Stubs de Supabase (auth, storage, roles)\n");

const files = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("No se encontraron migraciones en", MIGRATIONS_DIR);
  process.exit(1);
}

for (const file of files) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  try {
    await db.exec(sql);
    console.log(`✓ ${file}`);
  } catch (error) {
    console.error(`\n✗ ${file}\n`);
    console.error(error.message);
    process.exit(1);
  }
}

// --- Comprobaciones sobre el esquema resultante -----------------------------

const expectedTables = [
  "profiles",
  "communities",
  "community_memberships",
  "tournaments",
  "tournament_entries",
  "matches",
  "match_reports",
  "disputes",
  "player_stats",
];

const { rows: tables } = await db.query(
  `select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename`,
);
const tableNames = tables.map((row) => row.tablename);

const missing = expectedTables.filter((name) => !tableNames.includes(name));
if (missing.length) {
  console.error("\n✗ Faltan tablas:", missing.join(", "));
  process.exit(1);
}

// Regla estructural del producto: ninguna tabla queda sin RLS.
const unprotected = tables
  .filter((row) => expectedTables.includes(row.tablename) && !row.rowsecurity)
  .map((row) => row.tablename);

if (unprotected.length) {
  console.error("\n✗ Tablas sin RLS activo:", unprotected.join(", "));
  process.exit(1);
}

const { rows: policies } = await db.query(
  `select tablename, count(*)::int as total from pg_policies
   where schemaname = 'public' group by tablename order by tablename`,
);

const { rows: functions } = await db.query(
  `select proname from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' order by proname`,
);

const expectedFunctions = [
  "join_community_by_code",
  "submit_match_report",
  "confirm_match",
  "open_dispute",
  "resolve_dispute",
  "declare_walkover",
  "recalc_player_stats",
];
const functionNames = functions.map((row) => row.proname);
const missingFunctions = expectedFunctions.filter((fn) => !functionNames.includes(fn));

if (missingFunctions.length) {
  console.error("\n✗ Faltan funciones:", missingFunctions.join(", "));
  process.exit(1);
}

const { rows: triggers } = await db.query(
  `select tgname from pg_trigger where not tgisinternal order by tgname`,
);

const { rows: buckets } = await db.query(`select id from storage.buckets`);

console.log(`
────────────────────────────────────────────
  Esquema verificado contra Postgres real

  Tablas:     ${tableNames.length} (todas con RLS activo)
  Políticas:  ${policies.reduce((sum, row) => sum + row.total, 0)}
  Funciones:  ${functionNames.length}
  Triggers:   ${triggers.length}
  Buckets:    ${buckets.map((row) => row.id).join(", ") || "ninguno"}
────────────────────────────────────────────`);

await db.close();

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";

/**
 * Base de datos efímera para los tests de integración del esquema.
 *
 * PGlite es Postgres compilado a WebAssembly: corre dentro del proceso de Node,
 * sin Docker ni servidor. Eso permite ejercer la lógica que vive en la base —la
 * doble confirmación, las disputas, el recálculo de estadísticas— contra un
 * Postgres de verdad en vez de simularla con mocks, que es justo la parte del
 * producto donde un mock no prueba nada.
 *
 * Limitación conocida: PGlite corre como superusuario, y un superusuario ignora
 * RLS. Estos tests validan la LÓGICA de las funciones y los triggers, no que las
 * políticas autoricen a quien deben. Eso hay que probarlo contra Supabase real
 * con usuarios reales.
 */

const STUBS = "supabase/testing/supabase-stubs.sql";
const MIGRATIONS_DIR = "supabase/migrations";

export interface TestDb {
  /** Ejecuta SQL sin resultado. */
  exec(sql: string): Promise<void>;
  /** Ejecuta una consulta con parámetros y devuelve las filas. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Primera fila, o `null`. */
  one<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
  /** Cambia el usuario que devuelve `auth.uid()` de acá en adelante. */
  actAs(userId: string | null): Promise<void>;
  close(): Promise<void>;
}

/** Levanta una base nueva con los stubs y todas las migraciones aplicadas. */
export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite();

  await db.exec(readFileSync(STUBS, "utf8"));

  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrations) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }

  return {
    async exec(sql) {
      await db.exec(sql);
    },
    async query<T>(sql: string, params?: unknown[]) {
      const result = await db.query<T>(sql, params as never[]);
      return result.rows;
    },
    async one<T>(sql: string, params?: unknown[]) {
      const result = await db.query<T>(sql, params as never[]);
      return (result.rows[0] as T) ?? null;
    },
    async actAs(userId) {
      // `set_config` con literal parametrizado: el nombre del ajuste es fijo,
      // solo cambia el valor.
      await db.query("select set_config('test.user_id', $1, false)", [userId ?? ""]);
    },
    async close() {
      await db.close();
    },
  };
}

/** Crea un usuario de Supabase y su perfil (lo hace el trigger `on_auth_user_created`). */
export async function createUser(db: TestDb, name: string): Promise<string> {
  const row = await db.one<{ id: string }>(
    // El cast a text es necesario: `jsonb_build_object` acepta `any`, así que sin
    // él Postgres no puede inferir el tipo del parámetro.
    `insert into auth.users (email, raw_user_meta_data)
     values ($1, jsonb_build_object('display_name', $2::text))
     returning id`,
    [`${name.toLowerCase()}@embate.test`, name],
  );
  return row!.id;
}

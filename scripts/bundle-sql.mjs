/**
 * Genera un único archivo con todas las migraciones, en orden.
 *
 * El SQL Editor de Supabase ejecuta lo que uno pegue, así que pegar cuatro
 * archivos es cuatro oportunidades de equivocarse de orden o de saltarse uno.
 * Con esto se pega una sola vez.
 *
 * Se GENERA, no se mantiene a mano: la fuente de verdad sigue siendo
 * `supabase/migrations/`, y este archivo se regenera cuando cambien.
 *
 * Uso:
 *   npm run db:bundle
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "supabase/migrations";
const OUTPUT = "supabase/bundle.sql";

const files = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("No hay migraciones en", MIGRATIONS_DIR);
  process.exit(1);
}

const header = `-- =============================================================================
-- EMBATE — Esquema completo
-- =============================================================================
-- ARCHIVO GENERADO. No editar a mano: los cambios se pierden.
-- Fuente: supabase/migrations/  ·  Regenerar con: npm run db:bundle
--
-- Cómo usarlo:
--   1. Abrir el proyecto en supabase.com
--   2. Ir a SQL Editor → New query
--   3. Pegar TODO este archivo y ejecutar (Run)
--
-- Contiene: ${files.join(", ")}
-- =============================================================================

`;

const body = files
  .map((file) => {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8").trimEnd();
    return `\n-- ▼▼▼ ${file} ▼▼▼\n\n${sql}\n\n-- ▲▲▲ ${file} ▲▲▲\n`;
  })
  .join("\n");

mkdirSync("supabase", { recursive: true });
writeFileSync(OUTPUT, header + body);

const lines = (header + body).split("\n").length;
console.log(`✓ ${OUTPUT} — ${files.length} migraciones, ${lines} líneas`);
console.log("  Pegalo entero en el SQL Editor de Supabase y ejecutalo.");

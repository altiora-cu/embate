/**
 * Diagnóstico de puesta en marcha.
 *
 * Responde una sola pregunta: ¿qué falta para que la app funcione? Comprueba las
 * credenciales, conecta con Supabase, verifica que el esquema esté aplicado y
 * dice el siguiente paso concreto en vez de dejar que la app falle después con
 * un error de red sin contexto.
 *
 * Uso:
 *   npm run check
 */

import { readFileSync, existsSync } from "node:fs";

const TABLES = [
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

const ok = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const bad = (msg) => console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
const warn = (msg) => console.log(`  \x1b[33m!\x1b[0m ${msg}`);
const step = (msg) => console.log(`\n\x1b[1m${msg}\x1b[0m`);

/** Lee un .env sencillo sin dependencias. */
function readEnv(path) {
  const env = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
  }
  return env;
}

const pending = [];

console.log("\n\x1b[1mEmbate — diagnóstico de puesta en marcha\x1b[0m");

// --- 1. Credenciales -------------------------------------------------------

step("1. Credenciales");

if (!existsSync(".env.local")) {
  bad("No existe .env.local");
  pending.push("Ejecuta: cp .env.example .env.local");
}

const env = readEnv(".env.local");
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || url.includes("tu-proyecto")) {
  bad("Falta NEXT_PUBLIC_SUPABASE_URL");
  pending.push("Pon la Project URL en .env.local");
} else {
  ok(`URL del proyecto: ${url}`);
}

// La anon key es un JWT: siempre empieza por 'eyJ'.
const anonKeyLooksReal = anonKey && anonKey.startsWith("eyJ");
if (!anonKeyLooksReal) {
  bad("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY");
  pending.push(
    "Copia la clave 'anon public' desde Supabase → Project Settings → API\n" +
      "     y pégala en .env.local (empieza por eyJ...)",
  );
} else {
  ok("Clave anónima presente");
}

if (env.SUPABASE_SERVICE_ROLE_KEY?.startsWith("eyJ")) {
  ok("Clave de servicio presente (podrás sembrar datos de prueba)");
} else {
  warn("Sin SUPABASE_SERVICE_ROLE_KEY: la app funciona, pero no manda correos ni siembra datos");
}

// --- 2. Conexión y esquema -------------------------------------------------

if (url && anonKeyLooksReal) {
  step("2. Conexión con Supabase");

  const missing = [];
  let reachable = true;

  for (const table of TABLES) {
    try {
      const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });

      // 200 = existe y es legible. 401/403 = existe, pero RLS la protege (correcto).
      // 404 = la tabla no existe: falta aplicar el esquema.
      if (response.status === 404) missing.push(table);
    } catch {
      reachable = false;
      break;
    }
  }

  if (!reachable) {
    bad("No se pudo conectar con Supabase");
    pending.push("Revisa la URL del proyecto y tu conexión a internet");
  } else if (missing.length === TABLES.length) {
    bad("El proyecto responde, pero no tiene ninguna tabla");
    pending.push(
      "Abre Supabase → SQL Editor → New query,\n" +
        "     pega el contenido de supabase/bundle.sql y ejecuta (Run)",
    );
  } else if (missing.length > 0) {
    bad(`Faltan tablas: ${missing.join(", ")}`);
    pending.push("Vuelve a ejecutar supabase/bundle.sql: quedó a medias");
  } else {
    ok("Conexión correcta y las 9 tablas están aplicadas");
  }
} else {
  step("2. Conexión con Supabase");
  warn("Se omite: faltan credenciales");
}

// --- Resumen ---------------------------------------------------------------

if (pending.length === 0) {
  console.log(`
\x1b[32m────────────────────────────────────────────
  Todo listo. Levanta la app con:

    npm run dev

  Y abre http://localhost:3000
────────────────────────────────────────────\x1b[0m
`);
} else {
  console.log(`
\x1b[33m────────────────────────────────────────────
  Falta esto:\x1b[0m
`);
  pending.forEach((item, index) => console.log(`  ${index + 1}. ${item}`));
  console.log(`
  Cuando lo resuelvas, vuelve a ejecutar: npm run check
`);
  process.exitCode = 1;
}

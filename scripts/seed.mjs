/**
 * Siembra de datos de prueba para Embate.
 *
 * Crea una comunidad con jugadores, una liga en juego con resultados
 * confirmados, y una copa con un partido en disputa — lo suficiente para probar
 * la app como si fueras un organizador real, sin cargar nada a mano.
 *
 * Uso:
 *   node scripts/seed.mjs
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Es idempotente: si los usuarios ya existen los reutiliza, y borra la comunidad
 * de demostración antes de recrearla. NO ejecutar contra producción.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// --- Configuración ----------------------------------------------------------

loadEnvFile(".env.local");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en .env.local.",
  );
  process.exit(1);
}

const DEMO_SLUG = "liga-demo";
const DEMO_PASSWORD = "embate-demo-1234";

const PLAYERS = [
  { name: "Christian", gamertag: "CMirabal", platform: "ps5", admin: true },
  { name: "Dani", gamertag: "DaniFC", platform: "ps5" },
  { name: "Rulo", gamertag: "RuloTop", platform: "xbox" },
  { name: "Kev", gamertag: "KevSniper", platform: "pc" },
  { name: "Mati", gamertag: "MatiGol", platform: "ps5" },
  { name: "Nico", gamertag: "NicoWall", platform: "xbox" },
];

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- Utilidades -------------------------------------------------------------

/** Lee un .env sencillo sin dependencias externas. */
function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, "");
      if (value && !process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    // Sin archivo: se usan las variables que ya estén en el entorno.
  }
}

const email = (name) => `${name.toLowerCase()}@embate.test`;

function check(label, { error }) {
  if (error) {
    console.error(`✗ ${label}:`, error.message);
    process.exit(1);
  }
}

// --- Pasos ------------------------------------------------------------------

/** Crea (o reutiliza) las cuentas de prueba. */
async function ensureUsers() {
  const ids = new Map();
  const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 200 });

  for (const player of PLAYERS) {
    const address = email(player.name);
    const found = existing?.users.find((user) => user.email === address);

    if (found) {
      ids.set(player.name, found.id);
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: address,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: player.name },
    });
    if (error) {
      console.error(`✗ No se pudo crear ${address}:`, error.message);
      process.exit(1);
    }
    ids.set(player.name, data.user.id);
  }

  console.log(`✓ ${PLAYERS.length} cuentas listas (contraseña: ${DEMO_PASSWORD})`);
  return ids;
}

/** Borra la comunidad de demostración anterior para poder re-sembrar. */
async function resetCommunity() {
  const { data } = await supabase
    .from("communities")
    .select("id")
    .eq("slug", DEMO_SLUG)
    .maybeSingle();

  if (data) {
    check("borrar comunidad previa", await supabase.from("communities").delete().eq("id", data.id));
    console.log("✓ Comunidad de demostración anterior eliminada");
  }
}

async function createCommunity(ownerId) {
  const { data, error } = await supabase
    .from("communities")
    .insert({
      slug: DEMO_SLUG,
      name: "Liga Demo",
      brand_accent: "#C6FF3D",
      owner_id: ownerId,
    })
    .select("*")
    .single();

  check("crear comunidad", { error });
  return data;
}

async function addMembers(communityId, userIds) {
  const rows = PLAYERS.map((player) => ({
    community_id: communityId,
    user_id: userIds.get(player.name),
    role: player.admin ? "owner" : "player",
    gamertag: player.gamertag,
    platform: player.platform,
  }));

  check("agregar miembros", await supabase.from("community_memberships").insert(rows));
  console.log(`✓ ${rows.length} miembros agregados`);
}

async function createTournament(communityId, createdBy, config) {
  const { data, error } = await supabase
    .from("tournaments")
    .insert({ community_id: communityId, created_by: createdBy, ...config })
    .select("*")
    .single();

  check(`crear torneo ${config.name}`, { error });
  return data;
}

async function addEntries(tournamentId, userIds, players) {
  const rows = players.map((player, index) => ({
    tournament_id: tournamentId,
    user_id: userIds.get(player.name),
    gamertag: player.gamertag,
    platform: player.platform,
    seed: index + 1,
  }));

  const { data, error } = await supabase
    .from("tournament_entries")
    .insert(rows)
    .select("*");

  check("inscribir jugadores", { error });
  return data;
}

/**
 * Siembra una liga con parte de la jornada ya jugada.
 * Los resultados se escriben con `status: confirmed`, así que los triggers de la
 * base recalculan estadísticas y calificaciones igual que en el uso real.
 */
async function seedLeague(community, userIds) {
  const tournament = await createTournament(community.id, userIds.get("Christian"), {
    name: "Liga de Verano",
    format: "league",
    game_mode: "ultimate_team",
    size: 4,
    status: "in_progress",
  });

  const entries = await addEntries(tournament.id, userIds, PLAYERS.slice(0, 4));
  const [a, b, c, d] = entries;

  const fixtures = [
    { round: 1, position: 1, home: a, away: d, score: [3, 1] },
    { round: 1, position: 2, home: b, away: c, score: [2, 2] },
    { round: 2, position: 1, home: a, away: c, score: [1, 0] },
    { round: 2, position: 2, home: d, away: b, score: [0, 4] },
    { round: 3, position: 1, home: a, away: b, score: null },
    { round: 3, position: 2, home: c, away: d, score: null },
  ];

  const rows = fixtures.map((fixture) => ({
    tournament_id: tournament.id,
    round: fixture.round,
    position: fixture.position,
    home_entry_id: fixture.home.id,
    away_entry_id: fixture.away.id,
    status: fixture.score ? "confirmed" : "scheduled",
  }));

  const { data: matches, error } = await supabase.from("matches").insert(rows).select("*");
  check("crear partidos de liga", { error });

  // El marcador va en un UPDATE aparte para que dispare el trigger que deriva el
  // ganador y recalcula las estadísticas — igual que cuando lo carga un jugador.
  for (const [index, fixture] of fixtures.entries()) {
    if (!fixture.score) continue;
    check(
      "cargar resultado de liga",
      await supabase
        .from("matches")
        .update({
          home_score: fixture.score[0],
          away_score: fixture.score[1],
          status: "confirmed",
        })
        .eq("id", matches[index].id),
    );
  }

  console.log("✓ Liga de Verano: 4 jugadores, 4 resultados confirmados");
  return tournament;
}

/** Siembra una copa de 6 (con byes) y deja un partido en disputa. */
async function seedCup(community, userIds) {
  const tournament = await createTournament(community.id, userIds.get("Christian"), {
    name: "Copa Relámpago",
    format: "blitz",
    game_mode: "kick_off",
    size: 6,
    status: "in_progress",
  });

  const entries = await addEntries(tournament.id, userIds, PLAYERS.slice(0, 6));

  // Cuadro de 8 con 2 byes: los sembrados 1 y 2 pasan sin jugar.
  const [s1, s2, s3, s4, s5, s6] = entries;

  const { data: round1, error: r1Error } = await supabase
    .from("matches")
    .insert([
      {
        tournament_id: tournament.id,
        round: 1,
        position: 1,
        home_entry_id: s1.id,
        status: "walkover",
        winner_entry_id: s1.id,
      },
      {
        tournament_id: tournament.id,
        round: 1,
        position: 2,
        home_entry_id: s4.id,
        away_entry_id: s5.id,
        status: "scheduled",
      },
      {
        tournament_id: tournament.id,
        round: 1,
        position: 3,
        home_entry_id: s2.id,
        status: "walkover",
        winner_entry_id: s2.id,
      },
      {
        tournament_id: tournament.id,
        round: 1,
        position: 4,
        home_entry_id: s3.id,
        away_entry_id: s6.id,
        status: "scheduled",
      },
    ])
    .select("*");
  check("crear primera ronda de copa", { error: r1Error });

  const { data: rest, error: restError } = await supabase
    .from("matches")
    .insert([
      { tournament_id: tournament.id, round: 2, position: 1, home_entry_id: s1.id },
      { tournament_id: tournament.id, round: 2, position: 2, home_entry_id: s2.id },
      { tournament_id: tournament.id, round: 3, position: 1 },
    ])
    .select("*");
  check("crear rondas siguientes de copa", { error: restError });

  const semi1 = rest.find((m) => m.round === 2 && m.position === 1);
  const semi2 = rest.find((m) => m.round === 2 && m.position === 2);
  const final = rest.find((m) => m.round === 3);

  const links = [
    { id: round1[0].id, next_match_id: semi1.id, next_slot: "home" },
    { id: round1[1].id, next_match_id: semi1.id, next_slot: "away" },
    { id: round1[2].id, next_match_id: semi2.id, next_slot: "home" },
    { id: round1[3].id, next_match_id: semi2.id, next_slot: "away" },
    { id: semi1.id, next_match_id: final.id, next_slot: "home" },
    { id: semi2.id, next_match_id: final.id, next_slot: "away" },
  ];

  for (const link of links) {
    check(
      "enlazar cuadro",
      await supabase
        .from("matches")
        .update({ next_match_id: link.next_match_id, next_slot: link.next_slot })
        .eq("id", link.id),
    );
  }

  // Un partido en disputa, para poder probar el panel de administración.
  const disputed = round1[1];
  check(
    "marcar partido en disputa",
    await supabase.from("matches").update({ status: "disputed" }).eq("id", disputed.id),
  );

  check(
    "crear reportes en conflicto",
    await supabase.from("match_reports").insert([
      {
        match_id: disputed.id,
        reporter_id: userIds.get(PLAYERS[3].name),
        home_score: 2,
        away_score: 1,
      },
      {
        match_id: disputed.id,
        reporter_id: userIds.get(PLAYERS[4].name),
        home_score: 1,
        away_score: 2,
      },
    ]),
  );

  check(
    "abrir disputa",
    await supabase.from("disputes").insert({
      match_id: disputed.id,
      opened_by: userIds.get(PLAYERS[4].name),
      reason: "Marcadores en conflicto: 2-1 contra 1-2.",
    }),
  );

  console.log("✓ Copa Relámpago: 6 jugadores, 2 byes, 1 partido en disputa");
  return tournament;
}

// --- Ejecución --------------------------------------------------------------

const userIds = await ensureUsers();
await resetCommunity();

const community = await createCommunity(userIds.get("Christian"));
await addMembers(community.id, userIds);
await seedLeague(community, userIds);
await seedCup(community, userIds);

console.log(`
────────────────────────────────────────────
  Datos de prueba listos.

  Comunidad:  /c/${DEMO_SLUG}
  Código:     ${community.invite_code}

  Entrar como organizador:
    ${email("Christian")} / ${DEMO_PASSWORD}

  Entrar como jugador:
    ${email("Dani")} / ${DEMO_PASSWORD}
────────────────────────────────────────────`);

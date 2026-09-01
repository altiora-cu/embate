import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDb, createUser, type TestDb } from "./test-db";

/**
 * Tests de integración del mecanismo de confianza del producto (§4.5, §4.6).
 *
 * Toda esta lógica vive en Postgres a propósito: si el marcador se pudiera
 * escribir desde el navegador, el sistema de doble confirmación no valdría nada.
 * Por eso se prueba contra un Postgres real y no con mocks — un mock de
 * `submit_match_report` solo probaría que el mock funciona.
 */

let db: TestDb;

// Se comparten entre tests: crear la base y correr las migraciones toma ~1s.
let admin: string;
let alice: string;
let bob: string;
let communityId: string;

/** Deja la base en el estado inicial: una comunidad con tres miembros. */
async function resetFixtures() {
  await db.exec(`
    delete from public.disputes;
    delete from public.match_reports;
    delete from public.matches;
    delete from public.tournament_entries;
    delete from public.tournaments;
    delete from public.player_stats;
  `);
}

/** Crea un torneo con un partido entre los dos jugadores. Devuelve los ids. */
async function createMatchFixture(format = "cup") {
  const tournament = await db.one<{ id: string }>(
    `insert into public.tournaments (community_id, name, format, game_mode, size, status, created_by)
     values ($1, 'Torneo', $2, 'kick_off', 4, 'in_progress', $3)
     returning id`,
    [communityId, format, admin],
  );

  const entries = await db.query<{ id: string; user_id: string }>(
    `insert into public.tournament_entries (tournament_id, user_id, gamertag, platform, seed)
     values ($1, $2, 'alice', 'ps5', 1), ($1, $3, 'bob', 'ps5', 2)
     returning id, user_id`,
    [tournament!.id, alice, bob],
  );

  const aliceEntry = entries.find((e) => e.user_id === alice)!;
  const bobEntry = entries.find((e) => e.user_id === bob)!;

  const match = await db.one<{ id: string }>(
    `insert into public.matches (tournament_id, round, position, home_entry_id, away_entry_id)
     values ($1, 1, 1, $2, $3)
     returning id`,
    [tournament!.id, aliceEntry.id, bobEntry.id],
  );

  return {
    tournamentId: tournament!.id,
    matchId: match!.id,
    aliceEntryId: aliceEntry.id,
    bobEntryId: bobEntry.id,
  };
}

const statusOf = async (matchId: string) =>
  (await db.one<{ status: string }>(`select status from public.matches where id = $1`, [
    matchId,
  ]))!.status;

const statsOf = async (userId: string) =>
  await db.one<{
    wins: number;
    draws: number;
    losses: number;
    goals_for: number;
    no_shows: number;
    matches_on_time: number;
    disputes_total: number;
    disputes_lost: number;
  }>(`select * from public.player_stats where community_id = $1 and user_id = $2`, [
    communityId,
    userId,
  ]);

beforeAll(async () => {
  db = await createTestDb();

  admin = await createUser(db, "Admin");
  alice = await createUser(db, "Alice");
  bob = await createUser(db, "Bob");

  const community = await db.one<{ id: string }>(
    `insert into public.communities (slug, name, owner_id) values ('liga', 'Liga', $1) returning id`,
    [admin],
  );
  communityId = community!.id;

  await db.exec(`
    insert into public.community_memberships (community_id, user_id, role) values
      ('${communityId}', '${admin}', 'owner'),
      ('${communityId}', '${alice}', 'player'),
      ('${communityId}', '${bob}', 'player');
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(resetFixtures);

describe("perfil automático al registrarse", () => {
  it("crea el perfil con el nombre visible del registro", async () => {
    const profile = await db.one<{ display_name: string }>(
      `select display_name from public.profiles where id = $1`,
      [alice],
    );
    expect(profile?.display_name).toBe("Alice");
  });
});

describe("submit_match_report — primer reporte", () => {
  it("deja el partido esperando la confirmación del rival", async () => {
    const { matchId } = await createMatchFixture();

    await db.actAs(alice);
    const result = await db.one<{ submit_match_report: string }>(
      `select public.submit_match_report($1, 3, 1, null)`,
      [matchId],
    );

    expect(result?.submit_match_report).toBe("awaiting_confirmation");
    expect(await statusOf(matchId)).toBe("awaiting_confirmation");
  });

  it("NO da el partido por ganado con un solo reporte", async () => {
    const { matchId } = await createMatchFixture();

    await db.actAs(alice);
    await db.query(`select public.submit_match_report($1, 5, 0, null)`, [matchId]);

    const match = await db.one<{ winner_entry_id: string | null; home_score: number | null }>(
      `select winner_entry_id, home_score from public.matches where id = $1`,
      [matchId],
    );
    expect(match?.winner_entry_id).toBeNull();
    expect(match?.home_score).toBeNull();
  });

  it("rechaza a quien no juega el partido", async () => {
    const { matchId } = await createMatchFixture();

    await db.actAs(admin);
    await expect(
      db.query(`select public.submit_match_report($1, 1, 0, null)`, [matchId]),
    ).rejects.toThrow(/NOT_A_PARTICIPANT/);
  });

  it("corta el spam de reportes del mismo jugador", async () => {
    const { matchId } = await createMatchFixture();
    await db.actAs(alice);

    for (let i = 0; i < 3; i++) {
      await db.query(`select public.submit_match_report($1, $2, 0, null)`, [matchId, i]);
    }

    await expect(
      db.query(`select public.submit_match_report($1, 9, 0, null)`, [matchId]),
    ).rejects.toThrow(/TOO_MANY_REPORTS/);
  });
});

describe("doble confirmación (§4.5)", () => {
  it("confirma el partido cuando los dos cargan el mismo marcador", async () => {
    const { matchId, aliceEntryId } = await createMatchFixture();

    await db.actAs(alice);
    await db.query(`select public.submit_match_report($1, 3, 1, null)`, [matchId]);

    await db.actAs(bob);
    const result = await db.one<{ submit_match_report: string }>(
      `select public.submit_match_report($1, 3, 1, null)`,
      [matchId],
    );

    expect(result?.submit_match_report).toBe("confirmed");

    const match = await db.one<{ winner_entry_id: string; home_score: number }>(
      `select winner_entry_id, home_score from public.matches where id = $1`,
      [matchId],
    );
    // El ganador lo deriva la base del marcador; nunca lo manda el cliente.
    expect(match?.winner_entry_id).toBe(aliceEntryId);
    expect(match?.home_score).toBe(3);
  });

  it("permite al rival aceptar el marcador sin subir su propia captura", async () => {
    const { matchId } = await createMatchFixture();

    await db.actAs(alice);
    await db.query(`select public.submit_match_report($1, 2, 0, null)`, [matchId]);

    await db.actAs(bob);
    await db.query(`select public.confirm_match($1)`, [matchId]);

    expect(await statusOf(matchId)).toBe("confirmed");
  });

  it("impide auto-adjudicarse el partido confirmando el reporte propio", async () => {
    const { matchId } = await createMatchFixture();

    await db.actAs(alice);
    await db.query(`select public.submit_match_report($1, 7, 0, null)`, [matchId]);

    // Alice intenta confirmar su propio reporte: no hay nada del rival que aceptar.
    await expect(db.query(`select public.confirm_match($1)`, [matchId])).rejects.toThrow(
      /NOTHING_TO_CONFIRM/,
    );
  });
});

describe("disputas (§4.6)", () => {
  it("manda el partido a disputa cuando los marcadores no coinciden", async () => {
    const { matchId } = await createMatchFixture();

    await db.actAs(alice);
    await db.query(`select public.submit_match_report($1, 3, 1, null)`, [matchId]);

    await db.actAs(bob);
    const result = await db.one<{ submit_match_report: string }>(
      `select public.submit_match_report($1, 1, 3, null)`,
      [matchId],
    );

    expect(result?.submit_match_report).toBe("disputed");
    expect(await statusOf(matchId)).toBe("disputed");

    const dispute = await db.one<{ status: string; opened_by: string }>(
      `select status, opened_by from public.disputes where match_id = $1`,
      [matchId],
    );
    expect(dispute?.status).toBe("open");
  });

  it("no deja dos disputas abiertas sobre el mismo partido", async () => {
    const { matchId } = await createMatchFixture();

    await db.actAs(alice);
    await db.query(`select public.open_dispute($1, 'No se presentó')`, [matchId]);

    await db.actAs(bob);
    await expect(
      db.query(`select public.open_dispute($1, 'Otra cosa')`, [matchId]),
    ).rejects.toThrow();
  });

  it("solo la administración puede resolver", async () => {
    const { matchId } = await createMatchFixture();

    await db.actAs(alice);
    await db.query(`select public.submit_match_report($1, 3, 1, null)`, [matchId]);
    await db.actAs(bob);
    await db.query(`select public.submit_match_report($1, 1, 3, null)`, [matchId]);

    const dispute = await db.one<{ id: string }>(
      `select id from public.disputes where match_id = $1`,
      [matchId],
    );

    await db.actAs(alice);
    await expect(
      db.query(`select public.resolve_dispute($1, 3, 1, true, null)`, [dispute!.id]),
    ).rejects.toThrow(/ADMIN_REQUIRED/);
  });

  it("el marcador que pone la administración es el que queda", async () => {
    const { matchId, bobEntryId } = await createMatchFixture();

    await db.actAs(alice);
    await db.query(`select public.submit_match_report($1, 3, 1, null)`, [matchId]);
    await db.actAs(bob);
    await db.query(`select public.submit_match_report($1, 1, 3, null)`, [matchId]);

    const dispute = await db.one<{ id: string }>(
      `select id from public.disputes where match_id = $1`,
      [matchId],
    );

    await db.actAs(admin);
    await db.query(`select public.resolve_dispute($1, 0, 2, true, 'Se ve en la captura')`, [
      dispute!.id,
    ]);

    const match = await db.one<{ status: string; winner_entry_id: string; away_score: number }>(
      `select status, winner_entry_id, away_score from public.matches where id = $1`,
      [matchId],
    );
    expect(match?.status).toBe("confirmed");
    expect(match?.winner_entry_id).toBe(bobEntryId);
    expect(match?.away_score).toBe(2);
  });

  it("no se resuelve dos veces", async () => {
    const { matchId } = await createMatchFixture();

    await db.actAs(alice);
    await db.query(`select public.open_dispute($1, 'Marcador incorrecto')`, [matchId]);

    const dispute = await db.one<{ id: string }>(
      `select id from public.disputes where match_id = $1`,
      [matchId],
    );

    await db.actAs(admin);
    await db.query(`select public.resolve_dispute($1, 1, 0, true, null)`, [dispute!.id]);
    await expect(
      db.query(`select public.resolve_dispute($1, 2, 0, true, null)`, [dispute!.id]),
    ).rejects.toThrow(/DISPUTE_ALREADY_RESOLVED/);
  });
});

describe("estadísticas por comunidad", () => {
  it("suma la victoria al ganador y la derrota al perdedor", async () => {
    const { matchId } = await createMatchFixture();

    await db.actAs(alice);
    await db.query(`select public.submit_match_report($1, 4, 2, null)`, [matchId]);
    await db.actAs(bob);
    await db.query(`select public.confirm_match($1)`, [matchId]);

    const aliceStats = await statsOf(alice);
    const bobStats = await statsOf(bob);

    expect(aliceStats?.wins).toBe(1);
    expect(aliceStats?.losses).toBe(0);
    expect(aliceStats?.goals_for).toBe(4);
    expect(bobStats?.losses).toBe(1);
    expect(bobStats?.goals_for).toBe(2);
  });

  it("registra el empate como empate y no como derrota", async () => {
    const { matchId } = await createMatchFixture();

    await db.actAs(alice);
    await db.query(`select public.submit_match_report($1, 2, 2, null)`, [matchId]);
    await db.actAs(bob);
    await db.query(`select public.confirm_match($1)`, [matchId]);

    const aliceStats = await statsOf(alice);
    expect(aliceStats?.draws).toBe(1);
    expect(aliceStats?.wins).toBe(0);
    expect(aliceStats?.losses).toBe(0);
  });

  it("corrige las estadísticas cuando la administración cambia el marcador", async () => {
    const { matchId } = await createMatchFixture();

    await db.actAs(alice);
    await db.query(`select public.submit_match_report($1, 3, 0, null)`, [matchId]);
    await db.actAs(bob);
    await db.query(`select public.confirm_match($1)`, [matchId]);

    expect((await statsOf(alice))?.wins).toBe(1);

    // El admin da vuelta el resultado: no deben quedar rastros del anterior.
    await db.actAs(admin);
    await db.query(
      `update public.matches set home_score = 0, away_score = 3 where id = $1`,
      [matchId],
    );

    expect((await statsOf(alice))?.wins).toBe(0);
    expect((await statsOf(alice))?.losses).toBe(1);
    expect((await statsOf(bob))?.wins).toBe(1);
  });

  it("cuenta la incomparecencia contra la puntualidad del ausente", async () => {
    const { matchId, aliceEntryId } = await createMatchFixture();

    await db.actAs(admin);
    await db.query(`select public.declare_walkover($1, $2)`, [matchId, aliceEntryId]);

    const bobStats = await statsOf(bob);
    expect(bobStats?.no_shows).toBe(1);
    expect(bobStats?.matches_on_time).toBe(0);

    // Quien sí se presentó no recibe ningún castigo de puntualidad.
    const aliceStats = await statsOf(alice);
    expect(aliceStats?.no_shows).toBe(0);
    expect(aliceStats?.matches_on_time).toBe(1);
  });

  it("cuenta como disputa perdida la que el admin rechaza a quien la abrió", async () => {
    const { matchId } = await createMatchFixture();

    await db.actAs(bob);
    await db.query(`select public.open_dispute($1, 'Yo gané ese partido')`, [matchId]);

    const dispute = await db.one<{ id: string }>(
      `select id from public.disputes where match_id = $1`,
      [matchId],
    );

    await db.actAs(admin);
    await db.query(`select public.resolve_dispute($1, 2, 0, false, 'Sin pruebas')`, [
      dispute!.id,
    ]);

    const bobStats = await statsOf(bob);
    expect(bobStats?.disputes_total).toBe(1);
    expect(bobStats?.disputes_lost).toBe(1);

    const aliceStats = await statsOf(alice);
    expect(aliceStats?.disputes_total).toBe(1);
    expect(aliceStats?.disputes_lost).toBe(0);
  });
});

describe("avance en el cuadro", () => {
  it("mete al ganador en la ranura del partido siguiente", async () => {
    const tournament = await db.one<{ id: string }>(
      `insert into public.tournaments (community_id, name, format, game_mode, size, status, created_by)
       values ($1, 'Copa', 'cup', 'kick_off', 4, 'in_progress', $2) returning id`,
      [communityId, admin],
    );

    const entries = await db.query<{ id: string; user_id: string }>(
      `insert into public.tournament_entries (tournament_id, user_id, gamertag, platform, seed)
       values ($1, $2, 'alice', 'ps5', 1), ($1, $3, 'bob', 'ps5', 2)
       returning id, user_id`,
      [tournament!.id, alice, bob],
    );
    const aliceEntry = entries.find((e) => e.user_id === alice)!;
    const bobEntry = entries.find((e) => e.user_id === bob)!;

    const final = await db.one<{ id: string }>(
      `insert into public.matches (tournament_id, round, position) values ($1, 2, 1) returning id`,
      [tournament!.id],
    );

    const semi = await db.one<{ id: string }>(
      `insert into public.matches
        (tournament_id, round, position, home_entry_id, away_entry_id, next_match_id, next_slot)
       values ($1, 1, 1, $2, $3, $4, 'home') returning id`,
      [tournament!.id, aliceEntry.id, bobEntry.id, final!.id],
    );

    await db.actAs(alice);
    await db.query(`select public.submit_match_report($1, 1, 0, null)`, [semi!.id]);
    await db.actAs(bob);
    await db.query(`select public.confirm_match($1)`, [semi!.id]);

    const finalMatch = await db.one<{ home_entry_id: string | null }>(
      `select home_entry_id from public.matches where id = $1`,
      [final!.id],
    );
    expect(finalMatch?.home_entry_id).toBe(aliceEntry.id);
  });
});

describe("unirse por código de invitación", () => {
  it("rechaza un código que no existe", async () => {
    const outsider = await createUser(db, "Outsider");
    await db.actAs(outsider);

    await expect(
      db.query(`select * from public.join_community_by_code('NOEXISTE')`),
    ).rejects.toThrow(/INVALID_INVITE_CODE/);
  });

  it("agrega al jugador como 'player' con el código correcto", async () => {
    const newcomer = await createUser(db, "Newcomer");
    const community = await db.one<{ invite_code: string }>(
      `select invite_code from public.communities where id = $1`,
      [communityId],
    );

    await db.actAs(newcomer);
    await db.query(`select * from public.join_community_by_code($1)`, [
      community!.invite_code,
    ]);

    const membership = await db.one<{ role: string }>(
      `select role from public.community_memberships where community_id = $1 and user_id = $2`,
      [communityId, newcomer],
    );
    expect(membership?.role).toBe("player");
  });
});

describe("límite del plan gratuito", () => {
  /** Crea un torneo en la comunidad, devolviendo el error si el plan lo bloquea. */
  async function createTournament(name: string) {
    return db.query(
      `insert into public.tournaments
        (community_id, name, format, game_mode, status, created_by)
       values ($1, $2, 'league', 'kick_off', 'registration', $3)`,
      [communityId, name, admin],
    );
  }

  it("deja crear un torneo activo en plan gratuito", async () => {
    await expect(createTournament("Primero")).resolves.toBeDefined();
  });

  it("bloquea el segundo torneo activo mientras el plan sea gratuito", async () => {
    await createTournament("Primero");
    await expect(createTournament("Segundo")).rejects.toThrow(
      /FREE_PLAN_TOURNAMENT_LIMIT/,
    );
  });

  it("libera el cupo cuando el torneo anterior termina", async () => {
    await createTournament("Primero");
    await db.exec(`update public.tournaments set status = 'finished'`);
    await expect(createTournament("Segundo")).resolves.toBeDefined();
  });

  it("no limita al plan pro", async () => {
    await db.query(`select public.set_community_plan('liga', 'pro')`);
    await createTournament("Primero");
    await createTournament("Segundo");
    await expect(createTournament("Tercero")).resolves.toBeDefined();
    await db.query(`select public.set_community_plan('liga', 'free')`);
  });

  it("nunca corta un torneo ya en juego si la comunidad baja de plan", async () => {
    await db.query(`select public.set_community_plan('liga', 'pro')`);
    await createTournament("Primero");
    await createTournament("Segundo");
    await db.query(`select public.set_community_plan('liga', 'free')`);

    // Los dos siguen vivos: bajar de plan no destruye lo que ya está corriendo.
    const rows = await db.query<{ total: number }>(
      `select count(*)::int as total from public.tournaments where status = 'registration'`,
    );
    expect(rows[0].total).toBe(2);
  });

  it("rechaza un plan que no existe", async () => {
    await expect(
      db.query(`select public.set_community_plan('liga', 'enterprise')`),
    ).rejects.toThrow(/INVALID_PLAN/);
  });

  it("avisa cuando la comunidad no existe", async () => {
    await expect(
      db.query(`select public.set_community_plan('no-existe', 'pro')`),
    ).rejects.toThrow(/COMMUNITY_NOT_FOUND/);
  });
});

describe("límite de comunidades gratuitas por cuenta", () => {
  it("bloquea la segunda comunidad gratuita del mismo dueño", async () => {
    // `admin` ya es dueño de 'liga' desde el arranque de la suite.
    await expect(
      db.query(
        `insert into public.communities (slug, name, owner_id) values ('otra', 'Otra', $1)`,
        [admin],
      ),
    ).rejects.toThrow(/FREE_PLAN_COMMUNITY_LIMIT/);
  });

  it("deja crear otra cuando la primera pasó a Pro", async () => {
    await db.query(`select public.set_community_plan('liga', 'pro')`);

    await expect(
      db.query(
        `insert into public.communities (slug, name, owner_id) values ('segunda', 'Segunda', $1)`,
        [admin],
      ),
    ).resolves.toBeDefined();

    await db.exec(`delete from public.communities where slug = 'segunda'`);
    await db.query(`select public.set_community_plan('liga', 'free')`);
  });

  it("no limita a un dueño distinto", async () => {
    const otro = await createUser(db, "Organizador");
    await expect(
      db.query(
        `insert into public.communities (slug, name, owner_id) values ('tercera', 'Tercera', $1)`,
        [otro],
      ),
    ).resolves.toBeDefined();
    await db.exec(`delete from public.communities where slug = 'tercera'`);
  });
});

describe("cierre automático del torneo (0009)", () => {
  /** Liga en juego con dos partidos entre los mismos dos jugadores (ida y vuelta). */
  async function createTwoMatchLeague() {
    const tournament = await db.one<{ id: string }>(
      `insert into public.tournaments (community_id, name, format, game_mode, size, legs, status, created_by)
       values ($1, 'Liga corta', 'league', 'kick_off', 4, 2, 'in_progress', $2)
       returning id`,
      [communityId, admin],
    );

    const entries = await db.query<{ id: string; user_id: string }>(
      `insert into public.tournament_entries (tournament_id, user_id, gamertag, platform, seed)
       values ($1, $2, 'alice', 'ps5', 1), ($1, $3, 'bob', 'ps5', 2)
       returning id, user_id`,
      [tournament!.id, alice, bob],
    );
    const aliceEntry = entries.find((e) => e.user_id === alice)!;
    const bobEntry = entries.find((e) => e.user_id === bob)!;

    const matches = await db.query<{ id: string }>(
      `insert into public.matches (tournament_id, round, position, home_entry_id, away_entry_id)
       values ($1, 1, 1, $2, $3), ($1, 2, 1, $3, $2)
       returning id`,
      [tournament!.id, aliceEntry.id, bobEntry.id],
    );

    return { tournamentId: tournament!.id, matchIds: matches.map((m) => m.id) };
  }

  const tournamentStatus = async (id: string) =>
    (await db.one<{ status: string }>(
      `select status from public.tournaments where id = $1`,
      [id],
    ))!.status;

  async function settle(matchId: string, home: number, away: number) {
    await db.actAs(alice);
    await db.query(`select public.submit_match_report($1, $2, $3, null)`, [
      matchId,
      home,
      away,
    ]);
    await db.actAs(bob);
    await db.query(`select public.confirm_match($1)`, [matchId]);
  }

  it("sigue en juego mientras quede un partido pendiente", async () => {
    const { tournamentId, matchIds } = await createTwoMatchLeague();
    await settle(matchIds[0], 2, 1);
    expect(await tournamentStatus(tournamentId)).toBe("in_progress");
  });

  it("pasa a terminado al resolverse el último partido", async () => {
    const { tournamentId, matchIds } = await createTwoMatchLeague();
    await settle(matchIds[0], 2, 1);
    await settle(matchIds[1], 0, 3);
    expect(await tournamentStatus(tournamentId)).toBe("finished");
  });

  it("un partido en disputa mantiene el torneo abierto", async () => {
    const { tournamentId, matchIds } = await createTwoMatchLeague();
    await settle(matchIds[0], 2, 1);

    // Marcadores en conflicto en el último partido: queda disputado, no resuelto.
    await db.actAs(alice);
    await db.query(`select public.submit_match_report($1, 3, 0, null)`, [matchIds[1]]);
    await db.actAs(bob);
    await db.query(`select public.submit_match_report($1, 0, 3, null)`, [matchIds[1]]);

    expect(await tournamentStatus(tournamentId)).toBe("in_progress");
  });

  it("resolver la última disputa también cierra el torneo", async () => {
    const { tournamentId, matchIds } = await createTwoMatchLeague();
    await settle(matchIds[0], 2, 1);

    await db.actAs(alice);
    await db.query(`select public.submit_match_report($1, 3, 0, null)`, [matchIds[1]]);
    await db.actAs(bob);
    await db.query(`select public.submit_match_report($1, 0, 3, null)`, [matchIds[1]]);

    const dispute = await db.one<{ id: string }>(
      `select id from public.disputes where match_id = $1 and status = 'open'`,
      [matchIds[1]],
    );

    await db.actAs(admin);
    await db.query(`select public.resolve_dispute($1, 1, 2, false, null)`, [
      dispute!.id,
    ]);

    expect(await tournamentStatus(tournamentId)).toBe("finished");
  });

  it("no toca torneos cerrados a mano por el organizador", async () => {
    const { tournamentId, matchIds } = await createTwoMatchLeague();
    await db.exec(
      `update public.tournaments set status = 'cancelled' where id = '${tournamentId}'`,
    );
    await settle(matchIds[0], 2, 1);
    expect(await tournamentStatus(tournamentId)).toBe("cancelled");
  });
});

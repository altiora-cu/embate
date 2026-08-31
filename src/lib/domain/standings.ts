/**
 * Tabla de posiciones de liga (§4.1, ítem 9 y §4.11).
 *
 * Se calcula en memoria a partir de los partidos confirmados en vez de mantener
 * una tabla agregada en la base de datos: un torneo tiene como máximo decenas de
 * partidos, y así la tabla nunca puede quedar desincronizada con los resultados.
 */

import type { Match, StandingRow, TournamentEntry } from "./types";

/** Puntos por resultado. Estándar de liga de fútbol. */
const POINTS_WIN = 3;
const POINTS_DRAW = 1;
const POINTS_LOSS = 0;

/** Estados de partido que ya cuentan para la tabla. */
const SETTLED = new Set(["confirmed", "walkover"]);

/**
 * Construye la tabla ordenada.
 *
 * Solo suman los partidos `confirmed` (resultado en firme tras la doble confirmación)
 * y los `walkover` (adjudicados por incomparecencia). Los partidos `awaiting_confirmation`
 * y `disputed` **no** se cuentan: mostrar puntos que todavía pueden cambiar rompe la
 * confianza en la tabla, que es el objeto central del producto.
 *
 * Desempate, en orden: puntos → diferencia de goles → goles a favor → victorias →
 * gamertag (alfabético, para que el orden sea estable y reproducible).
 */
export function buildStandings(
  entries: readonly TournamentEntry[],
  matches: readonly Match[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const entry of entries) {
    rows.set(entry.id, {
      entryId: entry.id,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      winRate: 0,
      rank: 0,
    });
  }

  for (const match of matches) {
    if (!SETTLED.has(match.status)) continue;
    if (!match.homeEntryId || !match.awayEntryId) continue; // bye: no genera estadística

    const home = rows.get(match.homeEntryId);
    const away = rows.get(match.awayEntryId);
    if (!home || !away) continue; // inscripción eliminada: se ignora el partido

    // Un walkover puede no tener marcador; se adjudica 3-0 al ganador, como en liga real.
    const { homeScore, awayScore } = resolveScore(match);
    if (homeScore === null || awayScore === null) continue;

    home.played++;
    away.played++;
    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;
    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;

    if (homeScore > awayScore) {
      home.wins++;
      away.losses++;
      home.points += POINTS_WIN;
      away.points += POINTS_LOSS;
    } else if (homeScore < awayScore) {
      away.wins++;
      home.losses++;
      away.points += POINTS_WIN;
      home.points += POINTS_LOSS;
    } else {
      home.draws++;
      away.draws++;
      home.points += POINTS_DRAW;
      away.points += POINTS_DRAW;
    }
  }

  const gamertagOf = new Map(entries.map((e) => [e.id, e.gamertag]));

  const sorted = [...rows.values()]
    .map((row) => ({
      ...row,
      goalDifference: row.goalsFor - row.goalsAgainst,
      winRate: row.played === 0 ? 0 : row.wins / row.played,
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        b.wins - a.wins ||
        (gamertagOf.get(a.entryId) ?? "").localeCompare(gamertagOf.get(b.entryId) ?? ""),
    );

  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

/**
 * Marcador efectivo de un partido.
 * Un walkover sin marcador cargado se adjudica 3-0 al ganador.
 */
function resolveScore(match: Match): { homeScore: number | null; awayScore: number | null } {
  if (match.homeScore !== null && match.awayScore !== null) {
    return { homeScore: match.homeScore, awayScore: match.awayScore };
  }
  if (match.status === "walkover" && match.winnerEntryId) {
    const homeWon = match.winnerEntryId === match.homeEntryId;
    return { homeScore: homeWon ? 3 : 0, awayScore: homeWon ? 0 : 3 };
  }
  return { homeScore: null, awayScore: null };
}

/**
 * Ranking "más ganador" de la comunidad (§4, ítem 11).
 *
 * **Siempre acotado por comunidad** — quien llama debe pasar únicamente
 * las estadísticas de una comunidad. No existe un ranking global de la plataforma.
 */
export interface CommunityRankingRow {
  userId: string;
  wins: number;
  losses: number;
  draws: number;
  played: number;
  winRate: number;
  rank: number;
}

export function buildCommunityRanking(
  stats: readonly Omit<CommunityRankingRow, "winRate" | "rank" | "played">[],
): CommunityRankingRow[] {
  return stats
    .map((s) => {
      const played = s.wins + s.draws + s.losses;
      return { ...s, played, winRate: played === 0 ? 0 : s.wins / played };
    })
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.winRate - a.winRate ||
        b.played - a.played ||
        a.userId.localeCompare(b.userId),
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

import { describe, expect, it } from "vitest";

import { buildCommunityRanking, buildStandings } from "./standings";
import type { Match, MatchStatus, TournamentEntry } from "./types";

function entry(id: string, gamertag = id): TournamentEntry {
  return {
    id,
    tournamentId: "t1",
    userId: `u-${id}`,
    gamertag,
    platform: "ps5",
    seed: 1,
  };
}

function match(
  home: string | null,
  away: string | null,
  homeScore: number | null,
  awayScore: number | null,
  status: MatchStatus = "confirmed",
  winnerEntryId: string | null = null,
): Match {
  return {
    id: `m-${home}-${away}`,
    tournamentId: "t1",
    round: 1,
    position: 1,
    homeEntryId: home,
    awayEntryId: away,
    homeScore,
    awayScore,
    status,
    winnerEntryId,
    nextMatchId: null,
    nextSlot: null,
  };
}

describe("buildStandings", () => {
  const entries = [entry("a"), entry("b"), entry("c")];

  it("da 3 puntos por victoria y 0 por derrota", () => {
    const table = buildStandings(entries, [match("a", "b", 2, 1)]);
    const a = table.find((r) => r.entryId === "a")!;
    const b = table.find((r) => r.entryId === "b")!;
    expect(a.points).toBe(3);
    expect(a.wins).toBe(1);
    expect(b.points).toBe(0);
    expect(b.losses).toBe(1);
  });

  it("da 1 punto a cada uno por empate", () => {
    const table = buildStandings(entries, [match("a", "b", 1, 1)]);
    expect(table.find((r) => r.entryId === "a")!.points).toBe(1);
    expect(table.find((r) => r.entryId === "b")!.points).toBe(1);
    expect(table.find((r) => r.entryId === "a")!.draws).toBe(1);
  });

  it("incluye a los inscritos sin partidos jugados, en cero", () => {
    const table = buildStandings(entries, []);
    expect(table).toHaveLength(3);
    expect(table.every((r) => r.played === 0 && r.points === 0)).toBe(true);
  });

  it("acumula goles a favor y en contra desde ambos lados", () => {
    const table = buildStandings(entries, [
      match("a", "b", 3, 1),
      match("a", "c", 0, 2),
    ]);
    const a = table.find((r) => r.entryId === "a")!;
    expect(a.goalsFor).toBe(3);
    expect(a.goalsAgainst).toBe(3);
    expect(a.goalDifference).toBe(0);
    expect(a.played).toBe(2);
  });

  it("NO cuenta partidos pendientes de confirmación", () => {
    const table = buildStandings(entries, [
      match("a", "b", 5, 0, "awaiting_confirmation"),
    ]);
    expect(table.every((r) => r.played === 0)).toBe(true);
  });

  it("NO cuenta partidos en disputa", () => {
    const table = buildStandings(entries, [match("a", "b", 5, 0, "disputed")]);
    expect(table.every((r) => r.played === 0)).toBe(true);
  });

  it("NO cuenta partidos apenas programados", () => {
    const table = buildStandings(entries, [match("a", "b", null, null, "scheduled")]);
    expect(table.every((r) => r.played === 0)).toBe(true);
  });

  it("adjudica 3-0 en un walkover sin marcador cargado", () => {
    const table = buildStandings(entries, [
      match("a", "b", null, null, "walkover", "a"),
    ]);
    const a = table.find((r) => r.entryId === "a")!;
    const b = table.find((r) => r.entryId === "b")!;
    expect(a.points).toBe(3);
    expect(a.goalsFor).toBe(3);
    expect(b.goalsAgainst).toBe(3);
  });

  it("ignora los byes, que no tienen rival", () => {
    const table = buildStandings(entries, [match("a", null, null, null, "walkover", "a")]);
    expect(table.every((r) => r.played === 0)).toBe(true);
  });

  it("ordena por puntos de mayor a menor y numera las posiciones", () => {
    const table = buildStandings(entries, [
      match("a", "b", 1, 0),
      match("b", "c", 1, 0),
      match("a", "c", 1, 0),
    ]);
    expect(table.map((r) => r.entryId)).toEqual(["a", "b", "c"]);
    expect(table.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("desempata por diferencia de goles cuando hay igualdad de puntos", () => {
    const table = buildStandings([entry("a"), entry("b"), entry("c"), entry("d")], [
      match("a", "c", 5, 0),
      match("b", "d", 1, 0),
    ]);
    expect(table[0].entryId).toBe("a");
    expect(table[1].entryId).toBe("b");
  });

  it("desempata por goles a favor cuando la diferencia empata", () => {
    const table = buildStandings([entry("a"), entry("b"), entry("c"), entry("d")], [
      match("a", "c", 3, 2),
      match("b", "d", 1, 0),
    ]);
    expect(table[0].entryId).toBe("a");
  });

  it("produce un orden estable y reproducible en empate total", () => {
    const entries2 = [entry("z", "zeta"), entry("a", "alpha")];
    const first = buildStandings(entries2, []).map((r) => r.entryId);
    const second = buildStandings([...entries2].reverse(), []).map((r) => r.entryId);
    expect(first).toEqual(second);
    expect(first[0]).toBe("a"); // alfabético por gamertag
  });

  it("calcula el % de victorias sobre partidos jugados", () => {
    const table = buildStandings(entries, [
      match("a", "b", 1, 0),
      match("a", "c", 0, 1),
    ]);
    expect(table.find((r) => r.entryId === "a")!.winRate).toBeCloseTo(0.5);
  });

  it("ignora partidos de inscripciones eliminadas sin romper la tabla", () => {
    const table = buildStandings(entries, [match("a", "fantasma", 1, 0)]);
    expect(table).toHaveLength(3);
    expect(table.every((r) => r.played === 0)).toBe(true);
  });
});

describe("buildCommunityRanking", () => {
  it("ordena por victorias absolutas — el ranking es del 'más ganador'", () => {
    const ranking = buildCommunityRanking([
      { userId: "u1", wins: 3, draws: 0, losses: 7 },
      { userId: "u2", wins: 5, draws: 0, losses: 1 },
    ]);
    expect(ranking[0].userId).toBe("u2");
    expect(ranking[0].rank).toBe(1);
  });

  it("desempata por % de victorias cuando hay igual número de triunfos", () => {
    const ranking = buildCommunityRanking([
      { userId: "u1", wins: 5, draws: 0, losses: 5 },
      { userId: "u2", wins: 5, draws: 0, losses: 1 },
    ]);
    expect(ranking[0].userId).toBe("u2");
  });

  it("maneja jugadores sin partidos sin dividir por cero", () => {
    const ranking = buildCommunityRanking([{ userId: "u1", wins: 0, draws: 0, losses: 0 }]);
    expect(ranking[0].winRate).toBe(0);
    expect(ranking[0].played).toBe(0);
  });
});

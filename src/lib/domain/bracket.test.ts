import { describe, expect, it } from "vitest";

import {
  assignRandomSeeds,
  bracketSize,
  generateRoundRobin,
  generateSingleElimination,
  seedOrder,
  shuffle,
} from "./bracket";
import type { Platform, TournamentEntry } from "./types";

function makeEntries(count: number): TournamentEntry[] {
  const platforms: Platform[] = ["ps5", "xbox", "pc"];
  return Array.from({ length: count }, (_, i) => ({
    id: `e${i + 1}`,
    tournamentId: "t1",
    userId: `u${i + 1}`,
    gamertag: `player${i + 1}`,
    platform: platforms[i % platforms.length],
    seed: i + 1,
  }));
}

/** RNG determinista para que los tests de aleatoriedad sean reproducibles. */
function seededRng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe("bracketSize", () => {
  it("devuelve la siguiente potencia de 2 cuando el número no lo es", () => {
    expect(bracketSize(6)).toBe(8);
    expect(bracketSize(5)).toBe(8);
    expect(bracketSize(9)).toBe(16);
  });

  it("devuelve el mismo número cuando ya es potencia de 2", () => {
    expect(bracketSize(4)).toBe(4);
    expect(bracketSize(32)).toBe(32);
  });
});

describe("seedOrder", () => {
  it("coloca al 1 y al 2 en mitades opuestas del cuadro", () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("empareja siempre siembras complementarias en la primera ronda", () => {
    const order = seedOrder(16);
    for (let i = 0; i < order.length; i += 2) {
      expect(order[i] + order[i + 1]).toBe(17);
    }
  });
});

describe("shuffle", () => {
  it("no muta el arreglo original", () => {
    const original = [1, 2, 3, 4, 5];
    const copy = [...original];
    shuffle(original, seededRng(42));
    expect(original).toEqual(copy);
  });

  it("conserva todos los elementos", () => {
    const result = shuffle([1, 2, 3, 4, 5, 6], seededRng(7));
    expect([...result].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("assignRandomSeeds", () => {
  it("asigna siembras consecutivas desde 1 sin repetir", () => {
    const seeded = assignRandomSeeds(makeEntries(6), seededRng(99));
    expect(seeded.map((e) => e.seed).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("conserva a todos los inscritos", () => {
    const entries = makeEntries(8);
    const seeded = assignRandomSeeds(entries, seededRng(3));
    expect(new Set(seeded.map((e) => e.id))).toEqual(new Set(entries.map((e) => e.id)));
  });
});

describe("generateSingleElimination — cuadro con potencia de 2", () => {
  const matches = generateSingleElimination(makeEntries(8));

  it("genera exactamente n-1 partidos", () => {
    expect(matches).toHaveLength(7);
  });

  it("crea 3 rondas para 8 jugadores", () => {
    expect(new Set(matches.map((m) => m.round))).toEqual(new Set([1, 2, 3]));
  });

  it("no deja ningún bye cuando el cuadro está completo", () => {
    expect(matches.every((m) => m.status !== "walkover")).toBe(true);
  });

  it("inscribe a los 8 jugadores en la primera ronda, sin repetir", () => {
    const firstRound = matches.filter((m) => m.round === 1);
    const ids = firstRound.flatMap((m) => [m.homeEntryId, m.awayEntryId]);
    expect(ids.filter(Boolean)).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
  });

  it("enfrenta al primer sembrado con el último en la primera ronda", () => {
    const opener = matches.find((m) => m.round === 1 && m.position === 1);
    expect([opener?.homeEntryId, opener?.awayEntryId]).toEqual(["e1", "e8"]);
  });

  it("deja la final sin partido siguiente", () => {
    const final = matches.find((m) => m.round === 3);
    expect(final?.nextMatchKey).toBeNull();
    expect(final?.nextSlot).toBeNull();
  });

  it("enlaza cada partido no final con un partido existente de la ronda siguiente", () => {
    const keys = new Set(matches.map((m) => m.key));
    for (const match of matches.filter((m) => m.nextMatchKey)) {
      expect(keys.has(match.nextMatchKey!)).toBe(true);
    }
  });

  it("asigna ranuras home/away alternadas para que dos partidos alimenten al siguiente", () => {
    const r1 = matches.filter((m) => m.round === 1);
    expect(r1.map((m) => m.nextSlot)).toEqual(["home", "away", "home", "away"]);
  });
});

describe("generateSingleElimination — byes (§4.1, tamaños no potencia de 2)", () => {
  it("completa 6 inscritos en un cuadro de 8 con 2 byes", () => {
    const matches = generateSingleElimination(makeEntries(6));
    const byes = matches.filter((m) => m.status === "walkover");
    expect(byes).toHaveLength(2);
  });

  it("adjudica el bye al jugador presente, no lo deja pendiente", () => {
    const matches = generateSingleElimination(makeEntries(6));
    for (const bye of matches.filter((m) => m.status === "walkover")) {
      const present = bye.homeEntryId ?? bye.awayEntryId;
      expect(bye.winnerEntryId).toBe(present);
    }
  });

  it("da el bye a los primeros sembrados", () => {
    const matches = generateSingleElimination(makeEntries(6));
    const advancedByBye = matches
      .filter((m) => m.status === "walkover")
      .map((m) => m.winnerEntryId);
    expect(new Set(advancedByBye)).toEqual(new Set(["e1", "e2"]));
  });

  it("propaga al ganador del bye a la ronda siguiente de inmediato", () => {
    const matches = generateSingleElimination(makeEntries(6));
    const round2 = matches.filter((m) => m.round === 2);
    const placed = round2.flatMap((m) => [m.homeEntryId, m.awayEntryId]).filter(Boolean);
    expect(new Set(placed)).toEqual(new Set(["e1", "e2"]));
  });

  it("nunca empareja dos byes entre sí", () => {
    for (const size of [3, 5, 6, 7, 9, 11, 13, 17, 31]) {
      const matches = generateSingleElimination(makeEntries(size));
      const doubleByes = matches.filter(
        (m) => m.round === 1 && m.homeEntryId === null && m.awayEntryId === null,
      );
      expect(doubleByes, `tamaño ${size}`).toHaveLength(0);
    }
  });

  it("mantiene n-1 partidos reales jugables para cualquier tamaño", () => {
    for (const size of [4, 5, 6, 7, 8, 12, 16, 32]) {
      const matches = generateSingleElimination(makeEntries(size));
      const playable = matches.filter((m) => m.status !== "walkover");
      expect(playable.length, `tamaño ${size}`).toBe(size - 1);
    }
  });
});

describe("generateSingleElimination — validación", () => {
  it("rechaza torneos con menos de 2 inscritos", () => {
    expect(() => generateSingleElimination(makeEntries(1))).toThrow();
    expect(() => generateSingleElimination([])).toThrow();
  });
});

describe("generateRoundRobin — liga", () => {
  it("genera n(n-1)/2 partidos con número par de jugadores", () => {
    const matches = generateRoundRobin(makeEntries(6));
    expect(matches).toHaveLength(15);
  });

  it("genera n-1 jornadas con número par de jugadores", () => {
    const matches = generateRoundRobin(makeEntries(6));
    expect(new Set(matches.map((m) => m.round)).size).toBe(5);
  });

  it("hace que todos se enfrenten exactamente una vez", () => {
    const size = 8;
    const matches = generateRoundRobin(makeEntries(size));
    const pairs = matches.map((m) =>
      [m.homeEntryId, m.awayEntryId].sort().join("|"),
    );
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(pairs).toHaveLength((size * (size - 1)) / 2);
  });

  it("con número impar deja a un jugador descansando cada jornada", () => {
    const matches = generateRoundRobin(makeEntries(5));
    // 5 jugadores: 5 jornadas de 2 partidos = 10 partidos.
    expect(matches).toHaveLength(10);
    expect(new Set(matches.map((m) => m.round)).size).toBe(5);
    for (const round of [1, 2, 3, 4, 5]) {
      expect(matches.filter((m) => m.round === round)).toHaveLength(2);
    }
  });

  it("no enfrenta a nadie consigo mismo", () => {
    const matches = generateRoundRobin(makeEntries(7));
    expect(matches.every((m) => m.homeEntryId !== m.awayEntryId)).toBe(true);
  });

  it("reparte local y visitante sin que nadie juegue siempre del mismo lado", () => {
    const matches = generateRoundRobin(makeEntries(8));
    const homeCount = new Map<string, number>();
    for (const m of matches) {
      homeCount.set(m.homeEntryId!, (homeCount.get(m.homeEntryId!) ?? 0) + 1);
    }
    for (const [entryId, count] of homeCount) {
      expect(count, `${entryId} jugó ${count} veces de local de 7`).toBeGreaterThan(0);
      expect(count).toBeLessThan(7);
    }
  });

  it("no crea enlaces de avance: en liga no hay eliminación", () => {
    const matches = generateRoundRobin(makeEntries(4));
    expect(matches.every((m) => m.nextMatchKey === null)).toBe(true);
  });

  it("rechaza ligas con menos de 2 inscritos", () => {
    expect(() => generateRoundRobin(makeEntries(1))).toThrow();
  });
});

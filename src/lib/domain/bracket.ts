/**
 * Generación de cruces (§4.4).
 *
 * Módulo puro y sin dependencias: no conoce Supabase ni React. Devuelve partidos
 * identificados por una `key` local (`R1-M3`) en vez de un UUID, porque los UUID
 * solo existen tras el INSERT. La capa de persistencia inserta las filas, mapea
 * `key -> uuid` y recién entonces resuelve los enlaces `nextMatchKey`.
 */

import type { MatchSlot, MatchStatus, TournamentEntry } from "./types";

/** Partido tal como lo produce el generador, antes de tocar la base de datos. */
export interface GeneratedMatch {
  /** Identificador local estable dentro de la generación, ej. `R2-M1`. */
  key: string;
  round: number;
  position: number;
  homeEntryId: string | null;
  awayEntryId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  winnerEntryId: string | null;
  /** Partido al que avanza el ganador (solo eliminación directa). */
  nextMatchKey: string | null;
  nextSlot: MatchSlot | null;
}

/** Fuente de aleatoriedad inyectable: en tests se pasa una determinista. */
export type Rng = () => number;

const matchKey = (round: number, position: number) => `R${round}-M${position}`;

/**
 * Baraja una copia del arreglo (Fisher-Yates).
 * No muta la entrada: el orden original de inscripción se conserva.
 */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Asigna siembra aleatoria a los inscritos (§4.4: "cruces aleatorios").
 * La siembra determina el reparto de byes en eliminación directa.
 */
export function assignRandomSeeds(
  entries: readonly TournamentEntry[],
  rng: Rng = Math.random,
): TournamentEntry[] {
  return shuffle(entries, rng).map((entry, index) => ({ ...entry, seed: index + 1 }));
}

/** Menor potencia de 2 mayor o igual a `n`. `bracketSize(6) === 8`. */
export function bracketSize(n: number): number {
  if (n <= 1) return 1;
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/**
 * Orden de siembra estándar de un cuadro de eliminación directa.
 *
 * Devuelve los números de siembra en el orden en que ocupan las ranuras del cuadro,
 * de forma que el 1 y el 2 solo puedan cruzarse en la final. Para 8:
 * `[1, 8, 4, 5, 2, 7, 3, 6]`.
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const round = order.length * 2;
    const next: number[] = [];
    for (const seed of order) {
      next.push(seed, round + 1 - seed);
    }
    order = next;
  }
  return order;
}

/**
 * Cuadro de eliminación directa (Copa y Torneo Relámpago).
 *
 * Si el número de inscritos no es potencia de 2, se completa con **byes**: las
 * ranuras sobrantes quedan vacías y el jugador emparejado con un bye pasa de ronda
 * automáticamente (partido `walkover` ya resuelto). Los byes caen sobre los primeros
 * sembrados, que es el reparto estándar y el único que no deja a nadie con doble bye.
 */
export function generateSingleElimination(
  entries: readonly TournamentEntry[],
): GeneratedMatch[] {
  if (entries.length < 2) {
    throw new Error("Se necesitan al menos 2 inscritos para generar un cuadro.");
  }

  const bySeed = [...entries].sort((a, b) => a.seed - b.seed);
  const size = bracketSize(bySeed.length);
  const totalRounds = Math.log2(size);
  const order = seedOrder(size);

  // Ranuras del cuadro: `null` = bye (siembra inexistente porque faltan inscritos).
  const slots: (TournamentEntry | null)[] = order.map(
    (seed) => bySeed[seed - 1] ?? null,
  );

  const matches: GeneratedMatch[] = [];

  // Primera ronda: se emparejan ranuras contiguas.
  for (let i = 0; i < size / 2; i++) {
    const home = slots[i * 2];
    const away = slots[i * 2 + 1];
    const position = i + 1;
    const hasBye = home === null || away === null;
    const present = home ?? away;

    matches.push({
      key: matchKey(1, position),
      round: 1,
      position,
      homeEntryId: home?.id ?? null,
      awayEntryId: away?.id ?? null,
      homeScore: null,
      awayScore: null,
      // Un bye no se juega: queda adjudicado desde el arranque.
      status: hasBye ? "walkover" : "scheduled",
      winnerEntryId: hasBye ? (present?.id ?? null) : null,
      nextMatchKey: totalRounds > 1 ? matchKey(2, Math.floor(i / 2) + 1) : null,
      nextSlot: totalRounds > 1 ? (i % 2 === 0 ? "home" : "away") : null,
    });
  }

  // Rondas siguientes: ranuras vacías que se llenan al confirmarse la ronda previa.
  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = size / 2 ** round;
    for (let i = 0; i < matchesInRound; i++) {
      const position = i + 1;
      const isFinal = round === totalRounds;
      matches.push({
        key: matchKey(round, position),
        round,
        position,
        homeEntryId: null,
        awayEntryId: null,
        homeScore: null,
        awayScore: null,
        status: "scheduled",
        winnerEntryId: null,
        nextMatchKey: isFinal ? null : matchKey(round + 1, Math.floor(i / 2) + 1),
        nextSlot: isFinal ? null : i % 2 === 0 ? "home" : "away",
      });
    }
  }

  // Los byes de la primera ronda propagan su ganador de inmediato, para que el
  // cuadro se vea completo y coherente apenas se cierran las inscripciones.
  propagateResolvedByes(matches);

  return matches;
}

/** Empuja hacia la ronda siguiente los ganadores de partidos ya resueltos (byes). */
function propagateResolvedByes(matches: GeneratedMatch[]): void {
  const byKey = new Map(matches.map((m) => [m.key, m]));
  for (const match of matches) {
    if (match.status !== "walkover" || !match.winnerEntryId || !match.nextMatchKey) {
      continue;
    }
    const next = byKey.get(match.nextMatchKey);
    if (!next) continue;
    if (match.nextSlot === "home") next.homeEntryId = match.winnerEntryId;
    else next.awayEntryId = match.winnerEntryId;
  }
}

/**
 * Liga de todos contra todos, una vuelta (método del círculo).
 *
 * Con número impar de inscritos se agrega un bye rotativo: cada jornada un jugador
 * descansa. El local/visitante se alterna por jornada para que nadie juegue siempre
 * del mismo lado.
 */
export function generateRoundRobin(
  entries: readonly TournamentEntry[],
): GeneratedMatch[] {
  if (entries.length < 2) {
    throw new Error("Se necesitan al menos 2 inscritos para generar una liga.");
  }

  const bySeed = [...entries].sort((a, b) => a.seed - b.seed);
  // El `null` es el bye rotativo cuando el número de jugadores es impar.
  const wheel: (TournamentEntry | null)[] =
    bySeed.length % 2 === 0 ? [...bySeed] : [...bySeed, null];

  const n = wheel.length;
  const rounds = n - 1;
  const matches: GeneratedMatch[] = [];

  for (let round = 1; round <= rounds; round++) {
    let position = 1;
    for (let i = 0; i < n / 2; i++) {
      const home = wheel[i];
      const away = wheel[n - 1 - i];
      if (home === null || away === null) continue; // jornada de descanso

      // Alternar lados por jornada equilibra local/visitante a lo largo de la liga.
      const swap = round % 2 === 0;
      matches.push({
        key: matchKey(round, position),
        round,
        position,
        homeEntryId: (swap ? away : home).id,
        awayEntryId: (swap ? home : away).id,
        homeScore: null,
        awayScore: null,
        status: "scheduled",
        winnerEntryId: null,
        nextMatchKey: null,
        nextSlot: null,
      });
      position++;
    }

    // Rotación del círculo: el primero queda fijo, el resto gira una posición.
    wheel.splice(1, 0, wheel.pop()!);
  }

  return matches;
}

/** Punto de entrada único: elige el generador según el formato del torneo. */
export function generateMatches(
  format: "league" | "cup" | "blitz",
  entries: readonly TournamentEntry[],
): GeneratedMatch[] {
  return format === "league"
    ? generateRoundRobin(entries)
    : generateSingleElimination(entries);
}

/**
 * Campeón de un cuadro de eliminación directa.
 *
 * Es el ganador de la final, y la final es el único partido sin partido
 * siguiente. Devuelve `null` mientras no esté resuelta.
 */
export function findChampionEntryId(matches: readonly GeneratedMatch[] | readonly {
  round: number;
  nextMatchId?: string | null;
  nextMatchKey?: string | null;
  winnerEntryId: string | null;
}[]): string | null {
  if (matches.length === 0) return null;
  const lastRound = Math.max(...matches.map((match) => match.round));
  const final = matches.find(
    (match) =>
      match.round === lastRound &&
      !("nextMatchId" in match ? match.nextMatchId : match.nextMatchKey),
  );
  return final?.winnerEntryId ?? null;
}

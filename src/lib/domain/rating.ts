/**
 * Calificación de 5 estrellas (§4.1).
 *
 * Regla del paquete de dirección: **no puede ser solo el % de victorias**, porque eso
 * premia a quien esquiva rivales fuertes. Es una métrica de *confiabilidad* que combina
 * habilidad, puntualidad y comportamiento en disputas — es lo que hará viable el futuro
 * buscador de rivales (V2, ítem 18) sin que nadie tenga miedo de retar a un desconocido.
 */

import type { RatingBreakdown, RatingInput } from "./types";

/** Pesos de los tres componentes. Suman 1. */
const WEIGHT_WIN_RATE = 0.5;
const WEIGHT_PUNCTUALITY = 0.3;
const WEIGHT_INTEGRITY = 0.2;

/**
 * Partidos "virtuales" de valor neutro que se suman a la muestra real.
 *
 * Sin esto, quien gana su primer partido queda con 5.0 y quien lo pierde con 1.0,
 * lo que hace la calificación inútil justo cuando más se la mira (jugador nuevo).
 * Con el peso previo, la nota parte cerca del centro y se va ganando con volumen.
 */
const PRIOR_MATCHES = 5;

/** Por debajo de esta cantidad de partidos la calificación se marca como provisional. */
const PROVISIONAL_THRESHOLD = 5;

/** Valor neutro de cada componente cuando no hay historial. */
const NEUTRAL = 0.5;

export const MIN_RATING = 1;
export const MAX_RATING = 5;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Calcula la calificación compuesta y devuelve también el desglose,
 * para poder explicarle al jugador de dónde sale su nota en vez de mostrar
 * un número opaco.
 */
export function calculateRating(input: RatingInput): RatingBreakdown {
  const played = input.wins + input.draws + input.losses;

  // Habilidad: los empates valen medio triunfo, igual que en cualquier tabla.
  const rawWinRate = played === 0 ? NEUTRAL : (input.wins + input.draws * 0.5) / played;

  // Puntualidad: proporción de compromisos en los que se presentó.
  const commitments = input.matchesOnTime + input.noShows;
  const rawPunctuality =
    commitments === 0 ? NEUTRAL : clamp01(input.matchesOnTime / commitments);

  // Integridad: proporción de disputas que NO se resolvieron en su contra.
  const rawIntegrity =
    input.disputesTotal === 0
      ? 1 // sin disputas no hay nada que reprochar
      : clamp01(1 - input.disputesLost / input.disputesTotal);

  // Suavizado bayesiano: la muestra chica se acerca al valor neutro.
  const weight = played / (played + PRIOR_MATCHES);
  const winRate = NEUTRAL + (clamp01(rawWinRate) - NEUTRAL) * weight;
  const punctuality = NEUTRAL + (rawPunctuality - NEUTRAL) * weight;
  const integrity = NEUTRAL + (rawIntegrity - NEUTRAL) * weight;

  const composite = clamp01(
    winRate * WEIGHT_WIN_RATE +
      punctuality * WEIGHT_PUNCTUALITY +
      integrity * WEIGHT_INTEGRITY,
  );

  return {
    rating: round1(MIN_RATING + (MAX_RATING - MIN_RATING) * composite),
    winRate: clamp01(rawWinRate),
    punctuality: rawPunctuality,
    integrity: rawIntegrity,
    sampleSize: played,
    provisional: played < PROVISIONAL_THRESHOLD,
  };
}

/** Redondea a un decimal: la escala visible es 1.0 – 5.0. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Traduce la calificación a estrellas llenas / media / vacías,
 * para renderizar sin recalcular en el componente.
 */
export function toStars(rating: number): {
  full: number;
  half: boolean;
  empty: number;
} {
  const clamped = Math.min(MAX_RATING, Math.max(0, rating));
  const full = Math.floor(clamped);
  const half = clamped - full >= 0.5;
  return { full, half, empty: MAX_RATING - full - (half ? 1 : 0) };
}

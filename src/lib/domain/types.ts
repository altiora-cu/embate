/**
 * Tipos de dominio de Embate.
 *
 * Estos tipos describen el modelo de negocio y son deliberadamente independientes
 * de Supabase: la lógica pura (cruces, tabla, calificación) se prueba sin base de datos.
 * El mapeo desde/hacia las filas de Postgres vive en `src/lib/data/`.
 */

/** Formatos de torneo soportados (§4, MVP). */
export type TournamentFormat = "league" | "cup" | "blitz";

/** Modo de juego elegido por el organizador al crear el torneo (§4.2). */
export type GameMode = "ultimate_team" | "kick_off";

/**
 * Identificador del juego. El modelo NO asume un único título (§3, multi-juego):
 * hoy solo se activa EA Sports FC, pero el campo es abierto por diseño.
 */
export type GameId = "ea_sports_fc_26" | "ea_sports_fc_27";

/** Plataforma declarada por el jugador al inscribirse. */
export type Platform = "ps5" | "xbox" | "pc";

/** Rol dentro de una comunidad (tenant). */
export type CommunityRole = "owner" | "admin" | "player";

/** Ciclo de vida del torneo. */
export type TournamentStatus =
  | "draft"
  | "registration"
  | "in_progress"
  | "finished"
  | "cancelled";

/**
 * Estado de un partido.
 * - `scheduled`: cruce generado, aún sin resultado reportado.
 * - `awaiting_confirmation`: un jugador reportó; falta que el rival confirme (§4.5).
 * - `confirmed`: resultado en firme; ya impactó tabla y estadísticas.
 * - `disputed`: los reportes no coinciden o hay reclamo; lo resuelve el admin (§4.6).
 * - `walkover`: un jugador no se presentó; se adjudica sin jugar.
 */
export type MatchStatus =
  | "scheduled"
  | "awaiting_confirmation"
  | "confirmed"
  | "disputed"
  | "walkover";

/** Lado del cruce. En Copa determina a qué ranura del siguiente partido avanza el ganador. */
export type MatchSlot = "home" | "away";

/** Inscripción de un jugador a un torneo concreto. */
export interface TournamentEntry {
  id: string;
  tournamentId: string;
  userId: string;
  gamertag: string;
  platform: Platform;
  /** Orden de siembra (1 = primer sembrado). Determina el reparto de byes en Copa. */
  seed: number;
}

/**
 * Un cruce del torneo.
 *
 * `homeEntryId`/`awayEntryId` en `null` significan ranura aún no resuelta
 * (el ganador de una ronda previa todavía no está definido) o **bye**
 * cuando el partido ya está resuelto por walkover automático.
 */
export interface Match {
  id: string;
  tournamentId: string;
  /** Ronda 1 = primera ronda. En Liga, la jornada. */
  round: number;
  /** Posición dentro de la ronda, empezando en 1. Da orden estable al bracket. */
  position: number;
  homeEntryId: string | null;
  awayEntryId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  winnerEntryId: string | null;
  /** Solo en eliminación directa: partido al que avanza el ganador. */
  nextMatchId: string | null;
  /** Ranura que ocupará el ganador en `nextMatchId`. */
  nextSlot: MatchSlot | null;
}

/** Fila de la tabla de posiciones de una liga. */
export interface StandingRow {
  entryId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Porcentaje de victorias sobre partidos jugados, 0–1. */
  winRate: number;
  /** Posición final tras aplicar los criterios de desempate. 1 = líder. */
  rank: number;
}

/** Insumos para la calificación compuesta de 5 estrellas (§4.1). */
export interface RatingInput {
  wins: number;
  draws: number;
  losses: number;
  /** Partidos en los que el jugador se presentó y jugó en el plazo acordado. */
  matchesOnTime: number;
  /** Partidos perdidos por no presentarse (walkover en contra). */
  noShows: number;
  /** Disputas que abrió o defendió y que el admin resolvió en su contra. */
  disputesLost: number;
  /** Total de disputas en las que estuvo involucrado. */
  disputesTotal: number;
}

/** Resultado desglosado de la calificación, para poder explicarla en el perfil. */
export interface RatingBreakdown {
  /** Calificación final en la escala 1.0 – 5.0. */
  rating: number;
  /** Componente de habilidad (0–1). */
  winRate: number;
  /** Componente de puntualidad/asistencia (0–1). */
  punctuality: number;
  /** Componente de comportamiento en disputas (0–1). */
  integrity: number;
  /** Partidos considerados. Por debajo del umbral la nota se acerca al valor neutro. */
  sampleSize: number;
  /** `true` mientras la muestra sea demasiado chica para ser concluyente. */
  provisional: boolean;
}

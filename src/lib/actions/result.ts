/**
 * Resultado uniforme de una Server Action.
 *
 * `error` es siempre una CLAVE de traducción (`errors.*`), nunca un mensaje ya
 * traducido: la acción corre en el servidor y no sabe en qué idioma está el
 * usuario. Traducir es responsabilidad del componente que muestra el error.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const ok = <T = undefined>(data: T = undefined as T): ActionResult<T> => ({
  ok: true,
  data,
});

export const fail = (error: string): ActionResult<never> => ({ ok: false, error });

/** Códigos que las funciones de Postgres lanzan con RAISE EXCEPTION. */
const DB_ERROR_CODES = [
  "AUTH_REQUIRED",
  "INVALID_INVITE_CODE",
  "NOT_A_PARTICIPANT",
  "MATCH_NOT_FOUND",
  "MATCH_NOT_OPEN_FOR_REPORTS",
  "MATCH_NOT_AWAITING_CONFIRMATION",
  "MATCH_NOT_DISPUTABLE",
  "NOTHING_TO_CONFIRM",
  "TOO_MANY_REPORTS",
  "INVALID_SCORE",
  "DISPUTE_NOT_FOUND",
  "DISPUTE_ALREADY_RESOLVED",
  "ADMIN_REQUIRED",
  "WINNER_NOT_IN_MATCH",
  "REASON_REQUIRED",
  "FREE_PLAN_TOURNAMENT_LIMIT",
  "FREE_PLAN_COMMUNITY_LIMIT",
] as const;

/**
 * Traduce un error de Supabase/Postgres a una clave de `errors.*`.
 *
 * Si no reconoce el error devuelve `errors.generic`: nunca se filtra al usuario
 * el texto crudo de la base de datos, que podría exponer nombres de tablas.
 */
export function toErrorKey(error: unknown): string {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);

  const known = DB_ERROR_CODES.find((code) => message.includes(code));
  if (known) return `errors.${known}`;

  // Violación de restricción única de Postgres.
  if (message.includes("duplicate key") || message.includes("23505")) {
    return message.includes("slug") ? "errors.slugTaken" : "errors.generic";
  }
  if (message.includes("Invalid login credentials")) return "errors.invalidCredentials";
  if (message.includes("already registered") || message.includes("User already")) {
    return "errors.emailInUse";
  }

  return "errors.generic";
}

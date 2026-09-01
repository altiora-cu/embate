import { z } from "zod";

/**
 * Validación de entrada en el límite del sistema.
 *
 * Los mensajes son CLAVES de traducción; el componente las traduce. Estas reglas
 * duplican a propósito las restricciones CHECK de Postgres: la base es la última
 * línea de defensa, pero el usuario merece un error claro antes de llegar ahí.
 */

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const localeSchema = z.enum(["es", "en"]);
export const platformSchema = z.enum(["ps5", "xbox", "pc"]);
export const formatSchema = z.enum(["league", "cup", "blitz"]);
export const gameModeSchema = z.enum(["ultimate_team", "kick_off"]);

export const signUpSchema = z.object({
  email: z.email({ message: "validation.email" }),
  password: z.string().min(8, "validation.min"),
  displayName: z.string().trim().min(2, "validation.min").max(40, "validation.max"),
});

export const signInSchema = z.object({
  email: z.email({ message: "validation.email" }),
  password: z.string().min(1, "validation.required"),
});

export const createCommunitySchema = z.object({
  name: z.string().trim().min(2, "validation.min").max(60, "validation.max"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "validation.min")
    .max(40, "validation.max")
    .regex(SLUG_PATTERN, "validation.slug"),
  brandAccent: z.string().regex(HEX_COLOR, "validation.color").default("#C6FF3D"),
});

export const joinCommunitySchema = z.object({
  code: z.string().trim().toUpperCase().min(4, "validation.min").max(16, "validation.max"),
});

export const brandingSchema = z.object({
  name: z.string().trim().min(2, "validation.min").max(60, "validation.max"),
  brandAccent: z.string().regex(HEX_COLOR, "validation.color"),
  logoUrl: z.union([z.url(), z.literal("")]).optional(),
});

/**
 * Cupo del torneo.
 *
 * Vacío significa **sin límite**: el organizador decide cuándo hay suficiente
 * gente y cierra las inscripciones a mano. Un torneo no arranca por llenarse.
 */
const optionalSizeSchema = z
  .union([z.literal(""), z.coerce.number().int().min(2, "validation.min")])
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

/** Fecha opcional que llega del input `datetime-local` como texto. */
const optionalDateSchema = z
  .union([z.literal(""), z.string()])
  .optional()
  .transform((value) => (value ? value : null));

export const createTournamentSchema = z.object({
  name: z.string().trim().min(2, "validation.min").max(80, "validation.max"),
  format: formatSchema,
  gameMode: gameModeSchema,
  size: optionalSizeSchema,
  startsAt: optionalDateSchema,
  registrationClosesAt: optionalDateSchema,
  /** Vueltas de liga. Solo aplica al formato `league`; el resto la ignora. */
  legs: z.coerce.number().int().min(1).max(2).default(1),
});

export const registerEntrySchema = z.object({
  gamertag: z.string().trim().min(2, "validation.min").max(40, "validation.max"),
  platform: platformSchema,
});

const scoreSchema = z.coerce
  .number({ message: "validation.score" })
  .int("validation.score")
  .min(0, "validation.score")
  .max(99, "validation.score");

export const matchReportSchema = z.object({
  homeScore: scoreSchema,
  awayScore: scoreSchema,
});

export const disputeSchema = z.object({
  reason: z.string().trim().min(3, "validation.min").max(1000, "validation.max"),
});

export const resolveDisputeSchema = z.object({
  homeScore: scoreSchema,
  awayScore: scoreSchema,
  uphold: z.coerce.boolean(),
  note: z.string().trim().max(1000, "validation.max").optional(),
});

/** Restricciones de carga de capturas (§13). */
export const SCREENSHOT_MAX_BYTES = 8 * 1024 * 1024;
export const SCREENSHOT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Convierte un nombre en un slug web válido. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes y diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Primer mensaje de error por campo, listo para pintar en el formulario.
 * Devuelve claves de traducción, no texto.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { notifyPendingConfirmation } from "@/lib/email/notify";
import { absoluteUrl } from "@/lib/utils/url";
import {
  disputeSchema,
  fieldErrors,
  matchReportSchema,
  resolveDisputeSchema,
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_MIME_TYPES,
} from "@/lib/validation/schemas";

import { fail, ok, toErrorKey, type ActionResult } from "./result";
import type { FormState } from "./communities";

const SCREENSHOT_BUCKET = "match-screenshots";

/**
 * Sube la captura del marcador.
 *
 * La ruta empieza SIEMPRE por el `community_id` y el archivo por el `user_id`:
 * las políticas del bucket verifican ambas cosas, así que una captura no puede
 * caer en la carpeta de otra comunidad ni atribuirse a otro jugador (§13).
 */
async function uploadScreenshot(
  file: File,
  communityId: string,
  tournamentId: string,
  matchId: string,
  userId: string,
): Promise<ActionResult<string>> {
  if (file.size > SCREENSHOT_MAX_BYTES) return fail("errors.fileTooLarge");
  if (!SCREENSHOT_MIME_TYPES.includes(file.type as (typeof SCREENSHOT_MIME_TYPES)[number])) {
    return fail("errors.fileType");
  }

  const extension = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${communityId}/${tournamentId}/${matchId}/${userId}-${Date.now()}.${extension}`;

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) return fail(toErrorKey(error));
  return ok(path);
}

/** URL firmada de vida corta para mostrar una captura del bucket privado. */
export async function getScreenshotUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? null;
}

/**
 * Reporta el resultado de un partido (§4.5).
 *
 * La escritura del marcador la hace la función `submit_match_report` en Postgres,
 * no esta acción: el cliente nunca escribe directamente en `matches`. Acá solo se
 * valida la entrada y se sube la captura.
 */
export async function submitReportAction(
  context: {
    matchId: string;
    tournamentId: string;
    communityId: string;
    slug: string;
  },
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = matchReportSchema.safeParse({
    homeScore: formData.get("homeScore"),
    awayScore: formData.get("awayScore"),
  });

  if (!parsed.success) {
    return { status: "error", error: "errors.generic", fields: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", error: "errors.AUTH_REQUIRED" };

  let screenshotPath: string | null = null;
  const file = formData.get("screenshot");

  if (file instanceof File && file.size > 0) {
    const upload = await uploadScreenshot(
      file,
      context.communityId,
      context.tournamentId,
      context.matchId,
      user.id,
    );
    if (!upload.ok) return { status: "error", error: upload.error };
    screenshotPath = upload.data;
  }

  const { data: newStatus, error } = await supabase.rpc("submit_match_report", {
    p_match_id: context.matchId,
    p_home_score: parsed.data.homeScore,
    p_away_score: parsed.data.awayScore,
    p_screenshot_path: screenshotPath,
  });

  if (error) return { status: "error", error: toErrorKey(error) };

  // Solo se avisa cuando la pelota queda del lado del rival. Si el partido ya
  // quedó confirmado o en disputa, el correo sería ruido.
  if (newStatus === "awaiting_confirmation") {
    await notifyRivalOfPendingConfirmation(context, user.id, parsed.data);
  }

  revalidatePath(`/c/${context.slug}/t/${context.tournamentId}`, "layout");
  return { status: "success" };
}

/**
 * Manda al rival el aviso de "tenés un resultado por confirmar" (§13).
 * Nunca lanza: un problema de correo no puede tumbar el reporte ya guardado.
 */
async function notifyRivalOfPendingConfirmation(
  context: { matchId: string; tournamentId: string; slug: string },
  reporterId: string,
  score: { homeScore: number; awayScore: number },
): Promise<void> {
  try {
    const supabase = await createClient();

    const [{ data: match }, { data: tournament }, { data: reporter }] = await Promise.all([
      supabase
        .from("matches")
        .select("home_entry_id, away_entry_id")
        .eq("id", context.matchId)
        .maybeSingle(),
      supabase
        .from("tournaments")
        .select("name")
        .eq("id", context.tournamentId)
        .maybeSingle(),
      supabase.from("profiles").select("display_name").eq("id", reporterId).maybeSingle(),
    ]);

    const entryIds = [match?.home_entry_id, match?.away_entry_id].filter(
      (id): id is string => Boolean(id),
    );
    if (entryIds.length < 2) return;

    const { data: entries } = await supabase
      .from("tournament_entries")
      .select("user_id")
      .in("id", entryIds);

    const rivalId = (entries ?? [])
      .map((entry) => entry.user_id)
      .find((userId) => userId !== reporterId);
    if (!rivalId) return;

    await notifyPendingConfirmation({
      rivalUserId: rivalId,
      reporterName: reporter?.display_name ?? "",
      tournamentName: tournament?.name ?? "",
      homeScore: score.homeScore,
      awayScore: score.awayScore,
      matchUrl: await absoluteUrl(
        `/c/${context.slug}/t/${context.tournamentId}/m/${context.matchId}`,
      ),
    });
  } catch {
    // Aviso accesorio: el reporte ya está guardado.
  }
}

/** Acepta el resultado que cargó el rival: la otra mitad de la doble confirmación. */
export async function confirmMatchAction(
  matchId: string,
  tournamentId: string,
  slug: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_match", { p_match_id: matchId });

  if (error) return fail(toErrorKey(error));

  revalidatePath(`/c/${slug}/t/${tournamentId}`, "layout");
  return ok();
}

export async function openDisputeAction(
  context: { matchId: string; tournamentId: string; slug: string },
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = disputeSchema.safeParse({ reason: formData.get("reason") });

  if (!parsed.success) {
    return { status: "error", error: "errors.generic", fields: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("open_dispute", {
    p_match_id: context.matchId,
    p_reason: parsed.data.reason,
  });

  if (error) return { status: "error", error: toErrorKey(error) };

  revalidatePath(`/c/${context.slug}/t/${context.tournamentId}`, "layout");
  return { status: "success" };
}

/** Resuelve una disputa. Solo la administración de la comunidad (§4.6). */
export async function resolveDisputeAction(
  context: { disputeId: string; slug: string },
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resolveDisputeSchema.safeParse({
    homeScore: formData.get("homeScore"),
    awayScore: formData.get("awayScore"),
    uphold: formData.get("uphold") === "true",
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) {
    return { status: "error", error: "errors.generic", fields: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_dispute", {
    p_dispute_id: context.disputeId,
    p_home_score: parsed.data.homeScore,
    p_away_score: parsed.data.awayScore,
    p_uphold: parsed.data.uphold,
    p_note: parsed.data.note || null,
  });

  if (error) return { status: "error", error: toErrorKey(error) };

  revalidatePath(`/c/${context.slug}`, "layout");
  return { status: "success" };
}

/** Adjudica el partido por incomparecencia. Solo administración. */
export async function declareWalkoverAction(
  matchId: string,
  winnerEntryId: string,
  tournamentId: string,
  slug: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("declare_walkover", {
    p_match_id: matchId,
    p_winner_entry_id: winnerEntryId,
  });

  if (error) return fail(toErrorKey(error));

  revalidatePath(`/c/${slug}/t/${tournamentId}`, "layout");
  return ok();
}

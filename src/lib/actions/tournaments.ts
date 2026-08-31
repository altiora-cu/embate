"use server";

import { revalidatePath } from "next/cache";

import { localeRedirect } from "@/lib/utils/locale-redirect";
import { createClient } from "@/lib/supabase/server";
import { notifyMatchupsReady } from "@/lib/email/notify";
import { absoluteUrl } from "@/lib/utils/url";
import { assignRandomSeeds, generateMatches } from "@/lib/domain/bracket";
import type { TournamentEntry } from "@/lib/domain/types";
import {
  createTournamentSchema,
  fieldErrors,
  registerEntrySchema,
  slugify,
} from "@/lib/validation/schemas";

import { fail, ok, toErrorKey, type ActionResult } from "./result";
import type { FormState } from "./communities";

export async function createTournamentAction(
  communityId: string,
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = createTournamentSchema.safeParse({
    name: formData.get("name"),
    format: formData.get("format"),
    gameMode: formData.get("gameMode"),
    size: formData.get("size") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    registrationClosesAt: formData.get("registrationClosesAt") ?? "",
  });

  if (!parsed.success) {
    return { status: "error", error: "errors.generic", fields: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", error: "errors.AUTH_REQUIRED" };

  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      community_id: communityId,
      name: parsed.data.name,
      format: parsed.data.format,
      game_mode: parsed.data.gameMode,
      // `null` = sin límite de jugadores.
      size: parsed.data.size,
      status: "registration",
      starts_at: parsed.data.startsAt ? new Date(parsed.data.startsAt).toISOString() : null,
      registration_closes_at: parsed.data.registrationClosesAt
        ? new Date(parsed.data.registrationClosesAt).toISOString()
        : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) return { status: "error", error: toErrorKey(error) };

  revalidatePath(`/c/${slug}`);
  return localeRedirect(`/c/${slug}/t/${data.id}`);
}

/**
 * Torneo rápido: crear un torneo sin pasar por la pantalla de comunidades.
 *
 * La comunidad sigue existiendo por debajo — todo el aislamiento de datos
 * depende de ella — pero deja de ser un paso visible: si el usuario ya es dueño
 * de una, el torneo se crea ahí; si no, se le crea su espacio personal en el
 * mismo movimiento y queda parado en la pantalla del torneo con el enlace de
 * invitación listo para repartir.
 */
export async function quickTournamentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = createTournamentSchema.safeParse({
    name: formData.get("name"),
    format: formData.get("format"),
    gameMode: formData.get("gameMode"),
    size: formData.get("size") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    registrationClosesAt: formData.get("registrationClosesAt") ?? "",
  });

  if (!parsed.success) {
    return { status: "error", error: "errors.generic", fields: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", error: "errors.AUTH_REQUIRED" };

  const { data: owned } = await supabase
    .from("communities")
    .select("id, slug")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  let community = owned?.[0] ?? null;

  if (!community) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    const displayName = profile?.display_name?.trim() || "jugador";
    // Sufijo aleatorio: dos "Liga de Carlos" no deben pelearse por el slug.
    const suffix = Math.random().toString(36).slice(2, 6);
    const base = slugify(displayName).slice(0, 30);
    const slug = `${base || "liga"}-${suffix}`;

    const { data: created, error: communityError } = await supabase
      .from("communities")
      .insert({
        name: `Liga de ${displayName}`.slice(0, 60),
        slug,
        owner_id: user.id,
      })
      .select("id, slug")
      .single();

    if (communityError || !created) {
      return { status: "error", error: toErrorKey(communityError) };
    }

    const { error: membershipError } = await supabase
      .from("community_memberships")
      .insert({ community_id: created.id, user_id: user.id, role: "owner" });

    if (membershipError) {
      return { status: "error", error: toErrorKey(membershipError) };
    }

    community = created;
  }

  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      community_id: community.id,
      name: parsed.data.name,
      format: parsed.data.format,
      game_mode: parsed.data.gameMode,
      size: parsed.data.size,
      status: "registration",
      starts_at: parsed.data.startsAt
        ? new Date(parsed.data.startsAt).toISOString()
        : null,
      registration_closes_at: parsed.data.registrationClosesAt
        ? new Date(parsed.data.registrationClosesAt).toISOString()
        : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) return { status: "error", error: toErrorKey(error) };

  revalidatePath(`/c/${community.slug}`);
  return localeRedirect(`/c/${community.slug}/t/${data.id}`);
}

export async function registerAction(
  tournamentId: string,
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = registerEntrySchema.safeParse({
    gamertag: formData.get("gamertag"),
    platform: formData.get("platform"),
  });

  if (!parsed.success) {
    return { status: "error", error: "errors.generic", fields: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", error: "errors.AUTH_REQUIRED" };

  // El cupo se comprueba acá, pero RLS ya impide inscribirse fuera del período
  // de inscripción. En una carrera entre dos inscripciones el peor caso es un
  // inscrito de más, que el organizador puede dar de baja.
  const [{ data: tournament }, { count }] = await Promise.all([
    supabase
      .from("tournaments")
      .select("size, status, community_id, registration_closes_at")
      .eq("id", tournamentId)
      .single(),
    supabase
      .from("tournament_entries")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", tournamentId),
  ]);

  if (!tournament || tournament.status !== "registration") {
    return { status: "error", error: "errors.generic" };
  }

  if (
    tournament.registration_closes_at &&
    new Date(tournament.registration_closes_at) <= new Date()
  ) {
    return { status: "error", error: "errors.registrationClosed" };
  }

  // El cupo solo se comprueba si el organizador puso uno.
  if (tournament.size !== null && (count ?? 0) >= tournament.size) {
    return { status: "error", error: "errors.tournamentFull" };
  }

  const { error } = await supabase.from("tournament_entries").insert({
    tournament_id: tournamentId,
    user_id: user.id,
    gamertag: parsed.data.gamertag,
    platform: parsed.data.platform,
  });

  if (error) return { status: "error", error: toErrorKey(error) };

  // Se recuerdan como valores por defecto de ESTA comunidad: el ID con el que un
  // jugador recibe la invitación dentro del juego no cambia entre torneos, y
  // volver a pedirlo en cada inscripción es fricción pura.
  await supabase
    .from("community_memberships")
    .update({ gamertag: parsed.data.gamertag, platform: parsed.data.platform })
    .eq("user_id", user.id)
    .eq("community_id", tournament.community_id);

  revalidatePath(`/c/${slug}/t/${tournamentId}`);
  return { status: "success" };
}

export async function unregisterAction(
  tournamentId: string,
  slug: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("errors.AUTH_REQUIRED");

  const { error } = await supabase
    .from("tournament_entries")
    .delete()
    .eq("tournament_id", tournamentId)
    .eq("user_id", user.id);

  if (error) return fail(toErrorKey(error));

  revalidatePath(`/c/${slug}/t/${tournamentId}`);
  return ok();
}

/**
 * Cierra inscripciones y genera los cruces (§4.4).
 *
 * La generación es en dos pasos porque el bracket se referencia a sí mismo: el
 * generador produce partidos con claves locales (`R1-M2`), se insertan para
 * obtener sus UUID, y recién entonces se resuelven los enlaces `next_match_id`.
 * No hay forma de hacerlo en un solo INSERT sin conocer los UUID de antemano.
 */
export async function closeRegistrationAction(
  tournamentId: string,
  slug: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, format, status")
    .eq("id", tournamentId)
    .maybeSingle();

  if (!tournament) return fail("errors.generic");
  if (tournament.status !== "registration") return fail("errors.generic");

  const { data: entryRows, error: entriesError } = await supabase
    .from("tournament_entries")
    .select("*")
    .eq("tournament_id", tournamentId);

  if (entriesError) return fail(toErrorKey(entriesError));
  if (!entryRows || entryRows.length < 2) return fail("tournaments.needTwoPlayers");

  const entries: TournamentEntry[] = entryRows.map((row) => ({
    id: row.id,
    tournamentId: row.tournament_id,
    userId: row.user_id,
    gamertag: row.gamertag,
    platform: row.platform,
    seed: row.seed,
  }));

  // Siembra al azar: los cruces no se deciden por orden de inscripción.
  const seeded = assignRandomSeeds(entries);

  // UPDATE y no upsert: las inscripciones ya existen, y un upsert sería un INSERT
  // a ojos de RLS. La política de inserción exige `user_id = auth.uid()`, así que
  // el organizador no puede "insertar" las filas de sus jugadores — solo actualizarlas.
  for (const entry of seeded) {
    const { error } = await supabase
      .from("tournament_entries")
      .update({ seed: entry.seed })
      .eq("id", entry.id);
    if (error) return fail(toErrorKey(error));
  }

  const generated = generateMatches(tournament.format, seeded);

  // Paso 1: insertar los partidos sin los enlaces de avance.
  const { data: inserted, error: insertError } = await supabase
    .from("matches")
    .insert(
      generated.map((match) => ({
        tournament_id: tournamentId,
        round: match.round,
        position: match.position,
        home_entry_id: match.homeEntryId,
        away_entry_id: match.awayEntryId,
        status: match.status,
        winner_entry_id: match.winnerEntryId,
      })),
    )
    .select("id, round, position");

  if (insertError || !inserted) return fail(toErrorKey(insertError));

  // Paso 2: resolver `key -> uuid` y escribir los enlaces.
  const idByKey = new Map(
    inserted.map((row) => [`R${row.round}-M${row.position}`, row.id]),
  );

  const links = generated
    .filter((match) => match.nextMatchKey)
    .map((match) => ({
      id: idByKey.get(match.key)!,
      next_match_id: idByKey.get(match.nextMatchKey!)!,
      next_slot: match.nextSlot,
    }))
    .filter((link) => link.id && link.next_match_id);

  for (const link of links) {
    const { error } = await supabase
      .from("matches")
      .update({ next_match_id: link.next_match_id, next_slot: link.next_slot })
      .eq("id", link.id);
    if (error) return fail(toErrorKey(error));
  }

  // Los byes ya venían resueltos por el generador: hay que propagarlos ahora que
  // los enlaces existen, porque el trigger de inserción corrió antes de tenerlos.
  for (const match of generated) {
    if (match.status !== "walkover" || !match.winnerEntryId || !match.nextMatchKey) {
      continue;
    }
    const nextId = idByKey.get(match.nextMatchKey);
    if (!nextId) continue;

    // Se escribe la columna explícita en vez de una clave calculada: con una
    // clave dinámica el tipado de la tabla deja de aplicar y un error de nombre
    // pasaría desapercibido hasta producción.
    const patch =
      match.nextSlot === "home"
        ? { home_entry_id: match.winnerEntryId }
        : { away_entry_id: match.winnerEntryId };

    const { error } = await supabase.from("matches").update(patch).eq("id", nextId);
    if (error) return fail(toErrorKey(error));
  }

  const { error: statusError } = await supabase
    .from("tournaments")
    .update({ status: "in_progress" })
    .eq("id", tournamentId);

  if (statusError) return fail(toErrorKey(statusError));

  // Aviso "tu cruce está disponible" (§13). Va después de que todo esté guardado
  // y no bloquea el resultado: si el correo falla, el torneo ya arrancó igual.
  const { data: tournamentRow } = await supabase
    .from("tournaments")
    .select("name")
    .eq("id", tournamentId)
    .maybeSingle();

  await notifyMatchupsReady({
    userIds: seeded.map((entry) => entry.userId),
    tournamentName: tournamentRow?.name ?? "",
    tournamentUrl: await absoluteUrl(`/c/${slug}/t/${tournamentId}`),
  });

  revalidatePath(`/c/${slug}/t/${tournamentId}`);
  return ok();
}

export async function finishTournamentAction(
  tournamentId: string,
  slug: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tournaments")
    .update({ status: "finished" })
    .eq("id", tournamentId);

  if (error) return fail(toErrorKey(error));

  revalidatePath(`/c/${slug}/t/${tournamentId}`);
  return ok();
}

export async function removeEntryAction(
  entryId: string,
  tournamentId: string,
  slug: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("tournament_entries").delete().eq("id", entryId);
  if (error) return fail(toErrorKey(error));

  revalidatePath(`/c/${slug}/t/${tournamentId}`);
  return ok();
}

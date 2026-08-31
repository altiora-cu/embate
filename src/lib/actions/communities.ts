"use server";

import { revalidatePath } from "next/cache";

import { localeRedirect } from "@/lib/utils/locale-redirect";
import { createClient } from "@/lib/supabase/server";
import {
  brandingSchema,
  createCommunitySchema,
  fieldErrors,
  joinCommunitySchema,
} from "@/lib/validation/schemas";

import { fail, ok, toErrorKey, type ActionResult } from "./result";

export type FormState =
  | { status: "idle" }
  | { status: "error"; error: string; fields?: Record<string, string> }
  | { status: "success"; message?: string };

export async function createCommunityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = createCommunitySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    brandAccent: formData.get("brandAccent") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", error: "errors.generic", fields: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", error: "errors.AUTH_REQUIRED" };

  const { data: community, error } = await supabase
    .from("communities")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      brand_accent: parsed.data.brandAccent,
      owner_id: user.id,
    })
    .select("slug, id")
    .single();

  if (error || !community) {
    return { status: "error", error: toErrorKey(error) };
  }

  // El creador queda como dueño de su propia comunidad. Sin esto quedaría fuera
  // de la comunidad que acaba de crear, porque RLS pide membresía para leerla.
  const { error: membershipError } = await supabase
    .from("community_memberships")
    .insert({ community_id: community.id, user_id: user.id, role: "owner" });

  if (membershipError) {
    return { status: "error", error: toErrorKey(membershipError) };
  }

  return localeRedirect(`/c/${community.slug}`);
}

export async function joinCommunityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = joinCommunitySchema.safeParse({ code: formData.get("code") });

  if (!parsed.success) {
    return { status: "error", error: "errors.INVALID_INVITE_CODE" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_community_by_code", {
    p_code: parsed.data.code,
  });

  if (error) return { status: "error", error: toErrorKey(error) };

  const joined = data?.[0];
  if (!joined) return { status: "error", error: "errors.INVALID_INVITE_CODE" };

  return localeRedirect(`/c/${joined.slug}`);
}

export async function updateBrandingAction(
  communityId: string,
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = brandingSchema.safeParse({
    name: formData.get("name"),
    brandAccent: formData.get("brandAccent"),
    logoUrl: formData.get("logoUrl") ?? "",
  });

  if (!parsed.success) {
    return { status: "error", error: "errors.generic", fields: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("communities")
    .update({
      name: parsed.data.name,
      brand_accent: parsed.data.brandAccent,
      logo_url: parsed.data.logoUrl || null,
    })
    .eq("id", communityId);

  if (error) return { status: "error", error: toErrorKey(error) };

  revalidatePath(`/c/${slug}`, "layout");
  return { status: "success" };
}

/**
 * Enciende o apaga la página pública de la comunidad.
 *
 * Solo la administración puede tocarlo — lo garantiza la política RLS de
 * `communities`, no una comprobación acá.
 */
export async function setCommunityVisibilityAction(
  communityId: string,
  slug: string,
  isPublic: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("communities")
    .update({ is_public: isPublic })
    .eq("id", communityId);

  if (error) return fail(toErrorKey(error));

  revalidatePath(`/c/${slug}`, "layout");
  revalidatePath(`/v/${slug}`);
  return ok();
}

/** Actualiza el gamertag y la plataforma por defecto del jugador en la comunidad. */
export async function updateMembershipAction(
  communityId: string,
  gamertag: string,
  platform: "ps5" | "xbox" | "pc",
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("errors.AUTH_REQUIRED");

  const { error } = await supabase
    .from("community_memberships")
    .update({ gamertag: gamertag.trim(), platform })
    .eq("community_id", communityId)
    .eq("user_id", user.id);

  if (error) return fail(toErrorKey(error));
  return ok();
}

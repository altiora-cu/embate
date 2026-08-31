"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import { fail, ok, toErrorKey, type ActionResult } from "./result";

/**
 * Acciones de moderación del panel de plataforma.
 *
 * La autorización real vive en las funciones de Postgres (migración 0007):
 * si quien llama no es administrador de plataforma, la base lanza
 * ADMIN_REQUIRED sin importar lo que haga el cliente.
 */

export async function adminDeleteCommunityAction(
  communityId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_community", {
    p_community_id: communityId,
  });
  if (error) return fail(toErrorKey(error));

  revalidatePath("/admin");
  return ok();
}

export async function adminDeleteUserAction(userId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_user", { p_user_id: userId });
  if (error) return fail(toErrorKey(error));

  revalidatePath("/admin");
  return ok();
}

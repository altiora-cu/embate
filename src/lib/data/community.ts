import { notFound } from "next/navigation";

import { localeRedirect } from "@/lib/utils/locale-redirect";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type {
  CommunityRole,
  CommunityRow,
  Platform,
} from "@/lib/supabase/database.types";

export interface CommunityContext {
  community: CommunityRow;
  role: CommunityRole;
  userId: string;
  isAdmin: boolean;
  /**
   * Usuario y plataforma del jugador en esta comunidad.
   * Se guardan al inscribirse a un torneo para no volver a pedirlos: el ID con
   * el que recibís la invitación dentro del juego no cambia entre torneos.
   */
  gamertag: string | null;
  platform: Platform | null;
}

/** Usuario autenticado o redirección a login. Para layouts privados. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return localeRedirect("/login");
  return user;
}

/** Comunidades a las que pertenece el usuario actual, con su rol en cada una. */
export async function getMyCommunities() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("community_memberships")
    .select("role, joined_at, communities(*)")
    .order("joined_at", { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .filter((row) => row.communities)
    .map((row) => ({
      role: row.role as CommunityRole,
      community: row.communities as unknown as CommunityRow,
    }));
}

/**
 * Contexto de comunidad para una ruta `/c/[slug]`.
 *
 * Devuelve 404 —y no 403— cuando el usuario no es miembro: revelar que la
 * comunidad existe pero es ajena filtra información innecesariamente.
 */
export async function requireCommunity(slug: string): Promise<CommunityContext> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: community } = await supabase
    .from("communities")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!community) notFound();

  const { data: membership } = await supabase
    .from("community_memberships")
    .select("role, gamertag, platform")
    .eq("community_id", community.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) notFound();

  const role = membership.role as CommunityRole;
  return {
    community,
    role,
    userId: user.id,
    isAdmin: role === "owner" || role === "admin",
    gamertag: membership.gamertag,
    platform: membership.platform,
  };
}

/** Igual que `requireCommunity`, pero exige rol de administración. */
export async function requireCommunityAdmin(slug: string): Promise<CommunityContext> {
  const context = await requireCommunity(slug);
  if (!context.isAdmin) notFound();
  return context;
}

/** Miembros de la comunidad con su perfil, para listados de administración. */
export async function getCommunityMembers(communityId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("community_memberships")
    .select("user_id, role, gamertag, platform, joined_at, profiles(display_name)")
    .eq("community_id", communityId)
    .order("joined_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    userId: row.user_id,
    role: row.role as CommunityRole,
    gamertag: row.gamertag,
    platform: row.platform,
    displayName:
      (row.profiles as unknown as { display_name: string } | null)?.display_name ?? "",
  }));
}

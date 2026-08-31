import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * Datos del panel de plataforma.
 *
 * Todo pasa por RPCs con guardia `is_platform_admin()` o por las políticas
 * aditivas de la migración 0007: si quien consulta no es administrador de
 * plataforma, la base devuelve error o conjuntos vacíos — nunca datos ajenos.
 */

export interface AdminUserRow {
  id: string;
  email: string;
  display_name: string;
  is_admin: boolean;
  communities_owned: number;
  memberships: number;
  created_at: string;
}

export interface AdminCommunityRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
  members: number;
  tournaments: number;
}

export interface AdminTournamentRow {
  id: string;
  name: string;
  status: string;
  format: string;
  created_at: string;
  communityName: string;
  communitySlug: string;
}

/**
 * `true` si el usuario del request es administrador de plataforma.
 * Con `cache` para que header y página compartan una sola consulta por request.
 */
export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_platform_admin");
  return data === true;
});

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) throw error;
  return data ?? [];
}

export async function getAdminCommunities(): Promise<AdminCommunityRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("communities")
    .select("id, name, slug, plan, created_at, community_memberships(count), tournaments(count)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    created_at: row.created_at,
    members: row.community_memberships?.[0]?.count ?? 0,
    tournaments: row.tournaments?.[0]?.count ?? 0,
  }));
}

export async function getAdminTournaments(): Promise<AdminTournamentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, status, format, created_at, communities(name, slug)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    format: row.format,
    created_at: row.created_at,
    communityName: row.communities?.name ?? "",
    communitySlug: row.communities?.slug ?? "",
  }));
}

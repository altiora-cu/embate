import { createClient } from "@/lib/supabase/server";

/** Mensaje del chat con el nombre del autor ya resuelto, listo para pintar. */
export interface ChatMessage {
  id: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

/** Cuántos mensajes carga la pantalla al abrir. El resto es historia antigua. */
const CHAT_PAGE_SIZE = 100;

/**
 * Últimos mensajes del canal de la comunidad, en orden cronológico.
 * RLS garantiza que solo un miembro (o el operador de plataforma) puede leerlos.
 */
export async function getCommunityChat(communityId: string): Promise<ChatMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("community_messages")
    .select("id, user_id, body, created_at, profiles(display_name)")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false })
    .limit(CHAT_PAGE_SIZE);

  if (error) throw error;

  return (data ?? [])
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      authorName: row.profiles?.display_name ?? "",
      body: row.body,
      createdAt: row.created_at,
    }))
    .reverse();
}

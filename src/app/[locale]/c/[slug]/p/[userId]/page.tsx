import { PlayerProfileView } from "@/components/profile/player-profile";
import { requireCommunity } from "@/lib/data/community";
import { getPlayerProfile } from "@/lib/data/player";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ slug: string; userId: string }>;
}) {
  const { slug, userId } = await params;
  const { community } = await requireCommunity(slug);
  // RLS solo deja leer estadísticas de miembros de esta comunidad: un userId
  // ajeno devuelve un perfil vacío, nunca datos de otra comunidad.
  const profile = await getPlayerProfile(community.id, userId);

  return <PlayerProfileView profile={profile} communityName={community.name} />;
}

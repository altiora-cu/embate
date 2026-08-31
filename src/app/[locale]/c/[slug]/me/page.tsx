import { PlayerProfileView } from "@/components/profile/player-profile";
import { requireCommunity } from "@/lib/data/community";
import { getPlayerProfile } from "@/lib/data/player";

/** Atajo al perfil propio dentro de la comunidad. */
export default async function MyProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { community, userId } = await requireCommunity(slug);
  const profile = await getPlayerProfile(community.id, userId);

  return <PlayerProfileView profile={profile} communityName={community.name} />;
}

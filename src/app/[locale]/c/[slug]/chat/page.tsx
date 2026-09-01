import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CommunityChat } from "@/components/communities/community-chat";
import { getCommunityChat } from "@/lib/data/chat";
import { requireCommunity } from "@/lib/data/community";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chat");
  return { title: t("title") };
}

/**
 * Chat de la comunidad. Para coordinar amistosos fuera del torneo, pasar el ID
 * del juego o simplemente hablar. Solo miembros: `requireCommunity` devuelve
 * 404 a cualquier otro, y RLS repite el control en la base.
 */
export default async function CommunityChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { community, userId } = await requireCommunity(slug);
  const [t, messages] = await Promise.all([
    getTranslations("chat"),
    getCommunityChat(community.id),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-section">{t("title")}</h1>
        <p className="mt-1 text-body-sm text-muted">{t("subtitle")}</p>
      </div>

      <CommunityChat
        communityId={community.id}
        currentUserId={userId}
        initialMessages={messages}
      />
    </div>
  );
}

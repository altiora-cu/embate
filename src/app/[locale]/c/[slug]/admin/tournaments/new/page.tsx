import { getTranslations } from "next-intl/server";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CreateTournamentForm } from "@/components/tournaments/create-tournament-form";
import { requireCommunityAdmin } from "@/lib/data/community";

export default async function NewTournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("tournaments");
  const { community } = await requireCommunityAdmin(slug);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card>
        <CardHeader title={t("createTitle")} />
        <CardBody>
          <CreateTournamentForm communityId={community.id} slug={slug} />
        </CardBody>
      </Card>
    </div>
  );
}

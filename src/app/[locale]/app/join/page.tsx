import { getTranslations } from "next-intl/server";

import { JoinCommunityForm } from "@/components/communities/join-community-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export default async function JoinCommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const t = await getTranslations("communities");
  // Permite compartir un enlace directo con el código ya puesto: /app/join?code=ABCD2345
  const { code } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-lg">
      <Card>
        <CardHeader title={t("joinTitle")} description={t("joinSubtitle")} />
        <CardBody>
          <JoinCommunityForm defaultCode={code ?? ""} />
        </CardBody>
      </Card>
    </div>
  );
}

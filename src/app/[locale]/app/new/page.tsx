import { getTranslations } from "next-intl/server";

import { CreateCommunityForm } from "@/components/communities/create-community-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export default async function NewCommunityPage() {
  const t = await getTranslations("communities");

  return (
    <div className="mx-auto w-full max-w-lg">
      <Card>
        <CardHeader title={t("createTitle")} description={t("createSubtitle")} />
        <CardBody>
          <CreateCommunityForm />
        </CardBody>
      </Card>
    </div>
  );
}

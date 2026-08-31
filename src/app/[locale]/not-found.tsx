import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Isotipo } from "@/components/ui/logo";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-5 text-center">
      <Isotipo className="size-12 text-brand" />
      <h1 className="text-section">{t("errors.notFound")}</h1>
      <p className="max-w-sm text-body-sm text-muted">{t("errors.notFoundBody")}</p>
      <Link href="/">
        <Button variant="secondary">{t("nav.home")}</Button>
      </Link>
    </div>
  );
}

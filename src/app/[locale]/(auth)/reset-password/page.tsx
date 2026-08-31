import { getTranslations, setRequestLocale } from "next-intl/server";

import { ResetPasswordForm } from "@/components/auth/password-forms";

/** Destino del enlace de recuperación, ya con la sesión abierta por el callback. */
export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-section">{t("auth.resetTitle")}</h1>
        <p className="mt-1.5 text-body-sm text-muted">{t("auth.resetSubtitle")}</p>
      </div>

      <ResetPasswordForm />
    </div>
  );
}

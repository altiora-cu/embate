import { getTranslations, setRequestLocale } from "next-intl/server";

import { ForgotPasswordForm } from "@/components/auth/password-forms";
import { Link } from "@/i18n/navigation";

export default async function ForgotPage({
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
        <h1 className="text-section">{t("auth.forgotTitle")}</h1>
        <p className="mt-1.5 text-body-sm text-muted">{t("auth.forgotSubtitle")}</p>
      </div>

      <ForgotPasswordForm />

      <p className="text-center text-body-sm text-muted">
        <Link
          href="/login"
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          {t("nav.signIn")}
        </Link>
      </p>
    </div>
  );
}

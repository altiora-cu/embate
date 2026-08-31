import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthForm } from "@/components/auth/auth-form";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("signInTitle") };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-section">{t("auth.signInTitle")}</h1>
        <p className="mt-1.5 text-body-sm text-muted">{t("auth.signInSubtitle")}</p>
      </div>

      <AuthForm mode="signin" next={next} />

      <p className="-mt-3 text-center text-body-sm">
        <Link
          href="/forgot"
          className="text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          {t("auth.forgot")}
        </Link>
      </p>

      <p className="text-center text-body-sm text-muted">
        {t("auth.noAccount")}{" "}
        <Link
          href="/signup"
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          {t("nav.signUp")}
        </Link>
      </p>
    </div>
  );
}

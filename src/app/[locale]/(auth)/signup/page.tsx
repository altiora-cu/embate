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
  return { title: t("signUpTitle") };
}

export default async function SignUpPage({
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
        <h1 className="text-section">{t("auth.signUpTitle")}</h1>
        <p className="mt-1.5 text-body-sm text-muted">{t("auth.signUpSubtitle")}</p>
      </div>

      <AuthForm mode="signup" next={next} />

      <p className="text-center text-body-sm text-muted">
        {t("auth.hasAccount")}{" "}
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

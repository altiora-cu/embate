import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";

import { HeroBracket } from "@/components/marketing/hero-bracket";
import { SiteFooter } from "@/components/layout/site-footer";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const tNav = await getTranslations("nav");

  // Si ya entró, el CTA lo lleva a sus comunidades y no a repetir el registro.
  const user = isSupabaseConfigured() ? await getCurrentUser() : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-[var(--radius-control)] focus:bg-brand focus:px-3 focus:py-2 focus:text-brand-ink"
      >
        {tNav("skipToContent")}
      </a>

      <header className="sticky top-0 z-40 border-b border-surface-alt/40 bg-base/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Link href="/" aria-label="Embate">
            <Logo />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <LocaleSwitcher className="hidden sm:inline-flex" />
            {user ? (
              <Link href="/app">
                <Button size="sm">{tNav("myCommunities")}</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    {tNav("signIn")}
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm">{tNav("signUp")}</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="contenido" className="flex-1">
        <Hero
          title={t("heroTitle")}
          subtitle={t("heroSubtitle")}
          ctaPrimary={t("ctaPrimary")}
          ctaSecondary={t("ctaSecondary")}
          signedIn={Boolean(user)}
        />
        <Features />
        <HowItWorks />
      </main>

      <SiteFooter />
    </div>
  );
}

function Hero({
  title,
  subtitle,
  ctaPrimary,
  ctaSecondary,
  signedIn,
}: {
  title: string;
  subtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  signedIn: boolean;
}) {
  return (
    <section className="relative overflow-hidden border-b border-surface-alt/40">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-70" />
      {/* Halo del acento detrás del cuadro: da profundidad sin recurrir a un
          degradado genérico de fondo. */}
      <div className="pointer-events-none absolute top-1/2 right-0 size-[520px] -translate-y-1/2 translate-x-1/3 rounded-full bg-brand/10 blur-[120px]" />

      <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-surface-alt bg-surface px-3 py-1.5 text-meta text-muted">
            <span className="size-1.5 rounded-full bg-brand" />
            EA Sports FC 26 · FC 27
          </p>

          <h1 className="max-w-[15ch] text-[clamp(2.5rem,7vw,4.5rem)] leading-[0.95] font-bold tracking-[-0.03em] text-balance">
            {title}
          </h1>

          <p className="mt-6 max-w-lg text-subtitle leading-relaxed text-muted">
            {subtitle}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={signedIn ? "/app/new" : "/signup"}>
              <Button size="lg" className="w-full sm:w-auto">
                {ctaPrimary}
              </Button>
            </Link>
            <Link href={signedIn ? "/app/join" : "/login"}>
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                {ctaSecondary}
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative lg:justify-self-end">
          <HeroBracket className="w-full max-w-md lg:max-w-none" />
        </div>
      </div>
    </section>
  );
}

function Features() {
  const t = useTranslations("landing");

  const items = [
    { key: "formats", span: "sm:col-span-2" },
    { key: "trust", span: "" },
    { key: "reputation", span: "" },
    { key: "multi", span: "sm:col-span-2" },
  ] as const;

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <h2 className="text-section">{t("featuresTitle")}</h2>

      {/* Composición tipo bento: dos tarjetas anchas y dos angostas rompen la
          uniformidad del grid de tres columnas iguales. */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ key, span }) => (
          <article
            key={key}
            className={`group rounded-[var(--radius-card)] border border-surface-alt/60 bg-surface p-6 transition-colors duration-150 ease-(--ease-standard) hover:border-brand/40 ${span}`}
          >
            <h3 className="text-subtitle text-ink">
              {t(`features.${key}.title`)}
            </h3>
            <p className="mt-2 max-w-prose text-body-sm leading-relaxed text-muted">
              {t(`features.${key}.body`)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const t = useTranslations("landing");
  const steps = ["step1", "step2", "step3", "step4", "step5"] as const;

  return (
    <section className="border-t border-surface-alt/40">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <h2 className="text-section">{t("howTitle")}</h2>

        <ol className="mt-8 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-surface-alt/60 bg-surface-alt/60 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step, index) => (
            <li key={step} className="flex flex-col gap-3 bg-surface p-5">
              <span className="tnum font-display text-section leading-none font-bold text-brand">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="text-body-sm leading-relaxed text-muted">
                {t(`how.${step}`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

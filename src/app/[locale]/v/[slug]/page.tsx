import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Badge, LiveDot, TOURNAMENT_STATUS_TONE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { LegalDisclaimer } from "@/components/layout/legal-disclaimer";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { SiteFooter } from "@/components/layout/site-footer";
import { PublicTournamentView } from "@/components/public/public-tournament-view";
import { Link } from "@/i18n/navigation";
import {
  getPublicCommunity,
  getPublicTournament,
  getPublicTournaments,
} from "@/lib/data/public-view";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/layout/setup-required";
import { contrastInk, safeAccent } from "@/lib/utils/color";

const STATUS_LABEL = {
  draft: "statusDraft",
  registration: "statusRegistration",
  in_progress: "statusInProgress",
  finished: "statusFinished",
  cancelled: "statusCancelled",
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  if (!isSupabaseConfigured()) return {};
  const { slug } = await params;
  const community = await getPublicCommunity(slug);
  return {
    title: community.name,
    description: `Torneos y resultados de ${community.name} en Embate.`,
  };
}

/**
 * Página pública de una comunidad: `/v/mi-liga`.
 *
 * Solo lectura y sin cuenta. Es la pieza que hace compartible el producto —
 * alguien pega el enlace del bracket en su Discord, la gente lo mira y se suma.
 * Todo lo sensible queda fuera por RLS, no por esta pantalla.
 */
export default async function PublicCommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupRequired />;

  const { locale, slug } = await params;
  setRequestLocale(locale);

  const { t: selectedId } = await searchParams;
  const tr = await getTranslations();

  const community = await getPublicCommunity(slug);
  const tournaments = await getPublicTournaments(community.id);

  // Por defecto se abre el torneo más reciente: es lo que la gente viene a ver.
  const activeId = selectedId ?? tournaments[0]?.id;
  const detail = activeId
    ? await getPublicTournament(activeId, community.id)
    : null;

  const accent = safeAccent(community.brand_accent);
  const brandStyle = {
    "--brand-accent": accent,
    "--brand-accent-ink": contrastInk(accent),
  } as CSSProperties;

  return (
    <div className="flex min-h-dvh flex-col" style={brandStyle}>
      <header className="border-b border-surface-alt/60">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" aria-label="Embate">
              <Logo showWordmark={false} />
            </Link>
            <span className="truncate font-display text-subtitle font-bold">
              {community.name}
            </span>
            <Badge>{tr("publicView.badge")}</Badge>
          </div>

          <div className="flex items-center gap-2">
            <LocaleSwitcher className="hidden sm:inline-flex" />
            <Link href="/signup">
              <Button size="sm">{tr("publicView.joinCta")}</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-10">
        <p className="text-body-sm text-muted">
          {tr("publicView.subtitle", { community: community.name })}
        </p>

        {tournaments.length === 0 ? (
          <div className="mt-8">
            <EmptyState title={tr("publicView.noTournaments")} />
          </div>
        ) : (
          <>
            {/* Selector de torneo. Con uno solo no aporta nada, así que no aparece. */}
            {tournaments.length > 1 && (
              <nav className="mt-6 flex gap-2 overflow-x-auto pb-1">
                {tournaments.map((item) => {
                  const active = item.id === activeId;
                  return (
                    <Link
                      key={item.id}
                      href={`/v/${slug}?t=${item.id}`}
                      aria-current={active ? "page" : undefined}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-pill)] border px-3.5 py-2 text-body-sm transition-colors duration-150 ease-(--ease-standard) ${
                        active
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-surface-alt text-muted hover:text-ink"
                      }`}
                    >
                      {item.status === "in_progress" && <LiveDot />}
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            )}

            {detail && (
              <div className="mt-7 flex flex-col gap-7">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-section">{detail.tournament.name}</h1>
                  <Badge tone={TOURNAMENT_STATUS_TONE[detail.tournament.status]}>
                    {tr(`tournaments.${STATUS_LABEL[detail.tournament.status]}`)}
                  </Badge>
                </div>

                <PublicTournamentView detail={detail} />
              </div>
            )}
          </>
        )}

        <div className="mt-12 border-t border-surface-alt/60 pt-6">
          <LegalDisclaimer className="max-w-2xl" />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

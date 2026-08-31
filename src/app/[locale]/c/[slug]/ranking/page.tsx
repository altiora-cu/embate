import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/ui/card";
import { StarRating } from "@/components/ui/star-rating";
import { Link } from "@/i18n/navigation";
import { requireCommunity } from "@/lib/data/community";
import { getCommunityRanking } from "@/lib/data/player";
import { cn } from "@/lib/utils/cn";

/**
 * Ranking "más ganador" de la comunidad (§4, ítem 11).
 * Acotado por comunidad por diseño: no existe un ranking global de la plataforma.
 */
export default async function RankingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations();
  const { community, userId } = await requireCommunity(slug);
  const ranking = await getCommunityRanking(community.id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-section">{t("ranking.title")}</h1>
        <p className="mt-1 text-body-sm text-muted">
          {t("ranking.subtitle", { community: community.name })}
        </p>
      </header>

      {ranking.length === 0 ? (
        <EmptyState title={t("ranking.empty")} />
      ) : (
        <ol className="flex flex-col gap-2">
          {ranking.map((row, index) => (
            <li
              key={row.userId}
              className="animate-rise"
              style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
            >
              <Link
                href={`/c/${slug}/p/${row.userId}`}
                className={cn(
                  "flex items-center gap-4 rounded-[var(--radius-card)] border bg-surface px-4 py-3.5",
                  "transition-[border-color,transform] duration-150 ease-(--ease-standard)",
                  "hover:-translate-y-px hover:border-brand",
                  row.userId === userId ? "border-brand/50" : "border-surface-alt/60",
                )}
              >
                <span
                  className={cn(
                    "tnum w-8 shrink-0 text-center font-display text-subtitle font-bold",
                    // Solo el podio se destaca: si todo brilla, nada brilla.
                    row.rank <= 3 ? "text-brand" : "text-muted",
                  )}
                >
                  {row.rank}
                </span>

                <span className="min-w-0 flex-1 truncate font-medium">
                  {row.displayName}
                </span>

                <StarRating
                  rating={row.rating.rating}
                  size="sm"
                  showValue={false}
                  className="hidden sm:inline-flex"
                />

                <span className="tnum shrink-0 text-body-sm text-muted">
                  {row.played} {t("ranking.played").toLowerCase()}
                </span>

                <span className="tnum w-10 shrink-0 text-right font-display font-bold">
                  {row.wins}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

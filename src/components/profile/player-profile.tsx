import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { RatingComponentBar, StarRating } from "@/components/ui/star-rating";
import type { PlayerProfile as PlayerProfileData } from "@/lib/data/player";

/**
 * Perfil del jugador dentro de una comunidad.
 *
 * Criterio de aceptación (§12): la calificación de 5 estrellas y el V-D-E tienen
 * que verse sin navegar a ninguna subpágina. Por eso están arriba de todo y el
 * desglose de la nota va a continuación, no escondido tras un desplegable.
 */
export async function PlayerProfileView({
  profile,
  communityName,
}: {
  profile: PlayerProfileData;
  communityName: string;
}) {
  const t = await getTranslations();
  const { stats, rating } = profile;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-section">{profile.displayName}</h1>
          {profile.rank !== null && (
            <p className="mt-1 text-body-sm text-muted">
              {t("profile.rankingPosition", {
                rank: profile.rank,
                community: communityName,
              })}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <StarRating rating={rating.rating} size="lg" />
          {rating.provisional && (
            <Badge tone="warn">{t("profile.ratingProvisional")}</Badge>
          )}
        </div>
      </header>

      {/* V-D-E siempre visible, sin clics de por medio. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("profile.wins")} value={stats.wins} tone="brand" />
        <Stat label={t("profile.draws")} value={stats.draws} />
        <Stat label={t("profile.losses")} value={stats.losses} />
        <Stat
          label={t("profile.winRate")}
          value={`${Math.round(profile.winRate * 100)}%`}
        />
      </div>

      <Card>
        <CardHeader
          title={t("profile.ratingExplainTitle")}
          description={t("profile.ratingFormula")}
        />
        <CardBody className="flex flex-col gap-4">
          <RatingComponentBar label={t("profile.ratingSkill")} value={rating.winRate} />
          <RatingComponentBar
            label={t("profile.ratingPunctuality")}
            value={rating.punctuality}
          />
          <RatingComponentBar
            label={t("profile.ratingIntegrity")}
            value={rating.integrity}
          />
          {rating.provisional && (
            <p className="text-meta text-muted">{t("profile.ratingProvisionalHint")}</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("profile.goals")} />
        <CardBody className="grid grid-cols-2 gap-3">
          <Stat label={t("profile.goalsFor")} value={stats.goals_for} />
          <Stat label={t("profile.goalsAgainst")} value={stats.goals_against} />
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "brand";
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-surface-alt/60 bg-surface px-4 py-3.5">
      <p className="text-meta tracking-wide text-muted uppercase">{label}</p>
      <p
        className={`tnum mt-1 font-display text-section leading-none font-bold ${
          tone === "brand" ? "text-brand" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

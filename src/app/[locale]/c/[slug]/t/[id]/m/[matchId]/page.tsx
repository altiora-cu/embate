import { getFormatter, getTranslations } from "next-intl/server";

import { Badge, MATCH_STATUS_TONE } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmPanel } from "@/components/matches/confirm-panel";
import { MatchInvite } from "@/components/matches/match-invite";
import { ReportForm } from "@/components/matches/report-form";
import { ScreenshotLink } from "@/components/matches/screenshot-link";
import { Link } from "@/i18n/navigation";
import { requireCommunity } from "@/lib/data/community";
import { getMatchDetail } from "@/lib/data/tournament";
import type { MatchStatus } from "@/lib/domain/types";

const STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: "statusScheduled",
  awaiting_confirmation: "statusAwaiting",
  confirmed: "statusConfirmed",
  disputed: "statusDisputed",
  walkover: "statusWalkover",
};

export default async function MatchPage({
  params,
}: {
  params: Promise<{ slug: string; id: string; matchId: string }>;
}) {
  const { slug, id, matchId } = await params;
  const t = await getTranslations();
  const format = await getFormatter();
  const { community, userId } = await requireCommunity(slug);

  const { match, confirmedAt, home, away, reports, disputes } = await getMatchDetail(
    matchId,
    community.id,
  );

  const iAmHome = home?.userId === userId;
  const iAmAway = away?.userId === userId;
  const iPlay = iAmHome || iAmAway;

  // La inscripción propia y la del rival: de ahí salen el ID y la plataforma
  // que hacen falta para mandar la invitación dentro del juego.
  const me = iAmHome ? home : iAmAway ? away : null;
  const rival = iAmHome ? away : iAmAway ? home : null;

  const myReport = reports.find((report) => report.reporter_id === userId);
  const rivalReport = reports.find((report) => report.reporter_id !== userId);
  const openDispute = disputes.find((dispute) => dispute.status === "open");

  const homeName = home?.gamertag ?? t("match.pending");
  const awayName = away?.gamertag ?? t("match.pending");

  // Puede reportar quien juega, mientras el partido siga abierto y no haya
  // agotado su cupo de reportes (§13, anti-abuso).
  const canReport =
    iPlay &&
    (match.status === "scheduled" || match.status === "awaiting_confirmation") &&
    !myReport;

  // Puede confirmar quien juega y NO fue el que reportó: confirmar el propio
  // reporte sería auto-adjudicarse el partido.
  const canConfirm =
    iPlay && match.status === "awaiting_confirmation" && !myReport && Boolean(rivalReport);

  return (
    <div className="flex flex-col gap-7">
      <Link
        href={`/c/${slug}/t/${id}`}
        className="inline-flex w-fit items-center gap-1.5 text-body-sm text-muted transition-colors hover:text-ink"
      >
        <span aria-hidden="true">←</span>
        {t("common.back")}
      </Link>

      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={MATCH_STATUS_TONE[match.status]}>
            {t(`match.${STATUS_LABEL[match.status]}`)}
          </Badge>
          <span className="text-meta text-muted">
            {t("match.round", { round: match.round })}
          </span>
        </div>

        {/* El destello solo aparece con el resultado en firme: es la pantalla a
            la que se vuelve justo después de confirmar, y marca el cierre. */}
        <div
          className={`grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-[var(--radius-card)] border border-surface-alt/60 bg-surface px-5 py-7 ${
            match.status === "confirmed" ? "animate-flash" : ""
          }`}
        >
          <PlayerSide
            name={homeName}
            userId={home?.userId}
            slug={slug}
            isWinner={match.winnerEntryId === match.homeEntryId}
            align="right"
          />
          <span className="tnum font-display text-hero leading-none font-bold">
            {match.homeScore ?? "–"}
            <span className="mx-2 text-muted">:</span>
            {match.awayScore ?? "–"}
          </span>
          <PlayerSide
            name={awayName}
            userId={away?.userId}
            slug={slug}
            isWinner={match.winnerEntryId === match.awayEntryId}
            align="left"
          />
        </div>

        {match.status === "confirmed" && confirmedAt && (
          <p className="text-meta text-muted">
            {t("match.confirmedOn", {
              date: format.dateTime(new Date(confirmedAt), { dateStyle: "medium" }),
            })}
          </p>
        )}
      </header>

      {openDispute && (
        <div className="rounded-[var(--radius-card)] border border-danger/40 bg-danger/8 px-5 py-4">
          <p className="font-medium text-danger">{t("match.disputeOpen")}</p>
          <p className="mt-1.5 text-body-sm text-muted">{openDispute.reason}</p>
          <p className="mt-1 text-meta text-muted">
            {t("admin.openedBy", {
              name: openDispute.profiles?.display_name ?? "",
            })}
          </p>
        </div>
      )}

      {!iPlay && (
        <p className="text-body-sm text-muted">{t("match.youAreNotInThisMatch")}</p>
      )}

      {/* Cómo mandar la invitación dentro del juego. Solo mientras el partido
          esté por jugarse: una vez confirmado, el ID del rival ya no hace falta. */}
      {iPlay && rival && match.status === "scheduled" && (
        <MatchInvite
          rivalName={rival.displayName || rival.gamertag}
          rivalGamertag={rival.gamertag}
          rivalPlatform={rival.platform}
          myPlatform={me?.platform ?? null}
        />
      )}

      {canConfirm && rivalReport && (
        <Card>
          <CardHeader title={t("match.confirmResult")} />
          <CardBody>
            <ConfirmPanel
              matchId={match.id}
              tournamentId={id}
              slug={slug}
              reportedBy={rivalReport.profiles?.display_name ?? ""}
              homeName={homeName}
              awayName={awayName}
              homeScore={rivalReport.home_score}
              awayScore={rivalReport.away_score}
            />
          </CardBody>
        </Card>
      )}

      {canReport && (
        <Card>
          <CardHeader
            title={t("match.reportTitle")}
            description={t("match.reportSubtitle")}
          />
          <CardBody>
            <ReportForm
              context={{
                matchId: match.id,
                tournamentId: id,
                communityId: community.id,
                slug,
              }}
              homeName={homeName}
              awayName={awayName}
            />
          </CardBody>
        </Card>
      )}

      {iPlay && myReport && match.status === "awaiting_confirmation" && (
        <p className="text-body-sm text-warn">
          {t("match.awaitingRival", {
            name: (iAmHome ? away?.gamertag : home?.gamertag) ?? "",
          })}
        </p>
      )}

      <Card>
        <CardHeader title={t("match.reportsTitle")} />
        <CardBody>
          {reports.length === 0 ? (
            <p className="text-body-sm text-muted">{t("match.noReports")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-surface-alt/50">
              {reports.map((report) => (
                <li
                  key={report.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-medium">
                      {report.profiles?.display_name ?? ""}
                      {report.reporter_id === userId && (
                        <span className="ml-2 text-meta text-brand">
                          {t("match.yourReport")}
                        </span>
                      )}
                    </p>
                    <p className="text-meta text-muted">
                      {format.dateTime(new Date(report.created_at), {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="tnum font-display font-bold">
                      {report.home_score}
                      <span className="mx-1 text-muted">:</span>
                      {report.away_score}
                    </span>
                    <ScreenshotLink path={report.screenshot_path} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function PlayerSide({
  name,
  userId,
  slug,
  isWinner,
  align,
}: {
  name: string;
  userId?: string;
  slug: string;
  isWinner: boolean;
  align: "left" | "right";
}) {
  const className = `min-w-0 truncate font-display text-subtitle ${
    align === "right" ? "text-right" : "text-left"
  } ${isWinner ? "font-bold text-brand" : "text-ink"}`;

  return userId ? (
    <Link href={`/c/${slug}/p/${userId}`} className={`${className} hover:underline`}>
      {name}
    </Link>
  ) : (
    <span className={className}>{name}</span>
  );
}

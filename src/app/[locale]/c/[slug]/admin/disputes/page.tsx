import { getFormatter, getTranslations } from "next-intl/server";

import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { ResolveDisputeForm } from "@/components/admin/resolve-dispute-form";
import { ScreenshotLink } from "@/components/matches/screenshot-link";
import { Link } from "@/i18n/navigation";
import { requireCommunityAdmin } from "@/lib/data/community";
import { getOpenDisputes } from "@/lib/data/dispute";

/**
 * Bandeja de disputas.
 *
 * Todo lo necesario para decidir está en la misma tarjeta: el motivo, los dos
 * marcadores reportados y las dos capturas. El admin no debería tener que abrir
 * cinco pestañas para resolver un 2-1 contra un 1-2.
 */
export default async function DisputesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations();
  const format = await getFormatter();
  const { community } = await requireCommunityAdmin(slug);
  const disputes = await getOpenDisputes(community.id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-section">{t("admin.resolveTitle")}</h1>
        <p className="mt-1 text-body-sm text-muted">{t("admin.resolveSubtitle")}</p>
      </header>

      {disputes.length === 0 ? (
        <EmptyState title={t("admin.noDisputes")} />
      ) : (
        <ul className="flex flex-col gap-5">
          {disputes.map((dispute) => (
            <li key={dispute.id}>
              <Card className="border-danger/30">
                <CardHeader
                  title={`${dispute.homeName} — ${dispute.awayName}`}
                  description={`${dispute.tournamentName} · ${t("admin.openedBy", {
                    name: dispute.openedByName,
                  })} · ${format.dateTime(new Date(dispute.createdAt), {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}`}
                  action={
                    <Link
                      href={`/c/${slug}/t/${dispute.tournamentId}/m/${dispute.matchId}`}
                      className="text-body-sm text-signal underline-offset-4 hover:underline"
                    >
                      {t("match.title")}
                    </Link>
                  }
                />
                <CardBody className="flex flex-col gap-6">
                  <p className="rounded-[var(--radius-control)] border border-surface-alt bg-base px-4 py-3 text-body-sm text-muted">
                    {dispute.reason}
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {dispute.reports.map((report) => (
                      <div
                        key={report.id}
                        className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-surface-alt bg-base px-4 py-3"
                      >
                        <p className="truncate text-meta text-muted">
                          {report.reporterName}
                        </p>
                        <p className="tnum font-display text-subtitle font-bold">
                          {report.homeScore}
                          <span className="mx-1.5 text-muted">:</span>
                          {report.awayScore}
                        </p>
                        <ScreenshotLink path={report.screenshotPath} />
                      </div>
                    ))}
                  </div>

                  <ResolveDisputeForm
                    disputeId={dispute.id}
                    slug={slug}
                    homeName={dispute.homeName}
                    awayName={dispute.awayName}
                    suggestedHome={dispute.suggestedHome}
                    suggestedAway={dispute.suggestedAway}
                  />
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

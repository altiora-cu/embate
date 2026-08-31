import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { InviteCode } from "@/components/communities/invite-code";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { Link } from "@/i18n/navigation";
import { requireCommunity } from "@/lib/data/community";
import { listTournaments } from "@/lib/data/tournament";

export default async function CommunityHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations();
  const { community, isAdmin } = await requireCommunity(slug);
  const tournaments = await listTournaments(community.id);

  const active = tournaments.filter(
    (item) => item.tournament.status !== "finished" && item.tournament.status !== "cancelled",
  );
  const finished = tournaments.filter(
    (item) => item.tournament.status === "finished" || item.tournament.status === "cancelled",
  );

  return (
    <div className="flex flex-col gap-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-section">{t("tournaments.title")}</h1>
        {isAdmin && (
          <Link href={`/c/${slug}/admin/tournaments/new`}>
            <Button size="sm">{t("tournaments.createTitle")}</Button>
          </Link>
        )}
      </div>

      {isAdmin && <InviteCode code={community.invite_code} />}

      {tournaments.length === 0 ? (
        <EmptyState
          title={t("tournaments.empty")}
          body={isAdmin ? t("tournaments.emptyAdmin") : undefined}
          action={
            isAdmin ? (
              <Link href={`/c/${slug}/admin/tournaments/new`} className="mt-2">
                <Button>{t("tournaments.createTitle")}</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {active.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-body-sm font-medium tracking-wide text-muted uppercase">
                {t("tournaments.active")}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {active.map(({ tournament, entryCount }, index) => (
                  <li
                    key={tournament.id}
                    className="animate-rise"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <TournamentCard
                      tournament={tournament}
                      entryCount={entryCount}
                      slug={slug}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {finished.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-body-sm font-medium tracking-wide text-muted uppercase">
                {t("tournaments.finished")}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {finished.map(({ tournament, entryCount }, index) => (
                  <li
                    key={tournament.id}
                    className="animate-rise"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <TournamentCard
                      tournament={tournament}
                      entryCount={entryCount}
                      slug={slug}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

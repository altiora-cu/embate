import { getTranslations } from "next-intl/server";

import { Badge, LiveDot, TOURNAMENT_STATUS_TONE } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { BracketView } from "@/components/tournaments/bracket-view";
import { ChampionBanner } from "@/components/tournaments/champion-banner";
import { MatchList } from "@/components/tournaments/match-list";
import { StandingsTable } from "@/components/tournaments/standings-table";
import { RegisterForm, UnregisterButton } from "@/components/tournaments/register-form";
import { ShareLinks } from "@/components/tournaments/share-links";
import {
  CloseRegistrationButton,
  FinishTournamentButton,
} from "@/components/tournaments/tournament-actions";
import { Link } from "@/i18n/navigation";
import { findChampionEntryId } from "@/lib/domain/bracket";
import { requireCommunity } from "@/lib/data/community";
import { getTournamentDetail, standingsFor } from "@/lib/data/tournament";
import { absoluteUrl } from "@/lib/utils/url";

const STATUS_LABEL = {
  draft: "statusDraft",
  registration: "statusRegistration",
  in_progress: "statusInProgress",
  finished: "statusFinished",
  cancelled: "statusCancelled",
} as const;

const FORMAT_LABEL = {
  league: "formatLeague",
  cup: "formatCup",
  blitz: "formatBlitz",
} as const;

const MODE_LABEL = {
  ultimate_team: "gameModeUltimate",
  kick_off: "gameModeKickOff",
} as const;

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const t = await getTranslations();
  const { community, isAdmin, userId, gamertag, platform } =
    await requireCommunity(slug);
  const detail = await getTournamentDetail(id, community.id, userId);

  const { tournament, entries, matches, myEntry } = detail;
  const isLeague = tournament.format === "league";
  const isOpen = tournament.status === "registration";
  const hasMatches = matches.length > 0;
  // Sin cupo declarado nunca está lleno: el torneo lo cierra el organizador.
  const isFull = tournament.size !== null && entries.length >= tournament.size;

  // El plazo, si existe, corta las inscripciones — pero no arranca el torneo.
  const registrationExpired =
    tournament.registration_closes_at !== null &&
    new Date(tournament.registration_closes_at) <= new Date();

  const standings = isLeague && hasMatches ? standingsFor(detail) : [];

  // En liga gana el primero de la tabla; en copa, el ganador de la final.
  const championEntryId = isLeague
    ? (standings[0]?.entryId ?? null)
    : findChampionEntryId(matches);
  const champion = entries.find((entry) => entry.id === championEntryId);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={TOURNAMENT_STATUS_TONE[tournament.status]}>
            {tournament.status === "in_progress" && <LiveDot />}
            {t(`tournaments.${STATUS_LABEL[tournament.status]}`)}
          </Badge>
          <Badge>{t(`tournaments.${FORMAT_LABEL[tournament.format]}`)}</Badge>
          <Badge>{t(`tournaments.${MODE_LABEL[tournament.game_mode]}`)}</Badge>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="max-w-2xl text-hero leading-tight text-balance">
            {tournament.name}
          </h1>
          <p className="tnum text-body-sm text-muted">
            {tournament.size !== null
              ? t("tournaments.registered", {
                  count: entries.length,
                  size: tournament.size,
                })
              : t("tournaments.registeredOpen", { count: entries.length })}
          </p>
        </div>

        {tournament.status === "finished" && champion && (
          <ChampionBanner gamertag={champion.gamertag} />
        )}
      </header>

      {/* Los enlaces para compartir van arriba de todo para el organizador: es
          lo primero que necesita apenas crea el torneo. */}
      {isAdmin && (
        <ShareLinks
          inviteUrl={await absoluteUrl(
            `/i/${community.invite_code}?t=${tournament.id}`,
          )}
          publicUrl={community.is_public ? await absoluteUrl(`/v/${slug}`) : null}
        />
      )}

      {isAdmin && (
        <Card>
          <CardBody className="flex flex-wrap items-start justify-between gap-4">
            {isOpen ? (
              <CloseRegistrationButton
                tournamentId={tournament.id}
                slug={slug}
                disabled={entries.length < 2}
              />
            ) : (
              <p className="text-body-sm text-muted">
                {tournament.size !== null
                  ? t("tournaments.registered", {
                      count: entries.length,
                      size: tournament.size,
                    })
                  : t("tournaments.registeredOpen", { count: entries.length })}
              </p>
            )}
            {tournament.status === "in_progress" && (
              <FinishTournamentButton tournamentId={tournament.id} slug={slug} />
            )}
          </CardBody>
        </Card>
      )}

      {isOpen && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card>
            <CardHeader
              title={t("admin.entries")}
              action={
                myEntry ? (
                  <UnregisterButton tournamentId={tournament.id} slug={slug} />
                ) : undefined
              }
            />
            <CardBody>
              {entries.length === 0 ? (
                <p className="text-body-sm text-muted">{t("common.empty")}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-surface-alt/50">
                  {entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <Link
                        href={`/c/${slug}/p/${entry.userId}`}
                        className="truncate font-medium hover:text-brand"
                      >
                        {entry.gamertag}
                      </Link>
                      <Badge>{t(`entry.platform${platformKey(entry.platform)}`)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card className="h-fit">
            <CardHeader title={t("entry.title")} />
            <CardBody>
              {myEntry ? (
                <p className="text-body-sm text-brand">
                  {t("tournaments.registered_you")}
                </p>
              ) : isFull ? (
                <p className="text-body-sm text-muted">{t("tournaments.full")}</p>
              ) : registrationExpired ? (
                <p className="text-body-sm text-muted">{t("tournaments.closed")}</p>
              ) : (
                <RegisterForm
                  tournamentId={tournament.id}
                  slug={slug}
                  defaultGamertag={gamertag}
                  defaultPlatform={platform}
                />
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {!isOpen && !hasMatches && (
        <EmptyState title={t("common.empty")} body={t("tournaments.needTwoPlayers")} />
      )}

      {hasMatches && (
        <div className="flex flex-col gap-8">
          {isLeague ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-subtitle">{t("tournaments.standings")}</h2>
              <StandingsTable rows={standings} slug={slug} highlightUserId={userId} />
            </section>
          ) : (
            <section className="flex flex-col gap-3">
              <h2 className="text-subtitle">{t("tournaments.bracket")}</h2>
              <BracketView
                matches={matches}
                entries={entries}
                slug={slug}
                tournamentId={tournament.id}
                currentUserId={userId}
              />
            </section>
          )}

          <section className="flex flex-col gap-4">
            <h2 className="text-subtitle">{t("tournaments.calendar")}</h2>
            <MatchList
              matches={matches}
              entries={entries}
              slug={slug}
              tournamentId={tournament.id}
              isLeague={isLeague}
              currentUserId={userId}
            />
          </section>
        </div>
      )}
    </div>
  );
}

/** `ps5` -> `Ps5`, para componer la clave de traducción de la plataforma. */
function platformKey(platform: string): string {
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

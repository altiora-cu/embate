import { useTranslations } from "next-intl";

import { Badge, MATCH_STATUS_TONE } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import type { EntryWithPlayer } from "@/lib/data/tournament";
import type { Match, MatchStatus } from "@/lib/domain/types";

const STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: "statusScheduled",
  awaiting_confirmation: "statusAwaiting",
  confirmed: "statusConfirmed",
  disputed: "statusDisputed",
  walkover: "statusWalkover",
};

/**
 * Calendario de partidos, agrupado por ronda o jornada (§4, ítem 7).
 * Los partidos propios se marcan: en un torneo de 32 lo primero que busca
 * cualquiera es cuál le toca a él.
 */
export function MatchList({
  matches,
  entries,
  slug,
  tournamentId,
  isLeague,
  currentUserId,
}: {
  matches: Match[];
  entries: EntryWithPlayer[];
  slug: string;
  tournamentId: string;
  isLeague: boolean;
  currentUserId?: string;
}) {
  const t = useTranslations("match");
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const rounds = [...new Set(matches.map((match) => match.round))].sort((a, b) => a - b);
  const lastRound = rounds.at(-1);

  /** En copa, las últimas rondas tienen nombre propio: final, semis, cuartos. */
  function roundLabel(round: number): string {
    if (isLeague) return t("matchday", { round });
    if (lastRound === undefined) return t("round", { round });
    const fromEnd = lastRound - round;
    if (fromEnd === 0) return t("final");
    if (fromEnd === 1) return t("semifinal");
    if (fromEnd === 2) return t("quarterfinal");
    return t("round", { round });
  }

  return (
    <div className="flex flex-col gap-7">
      {rounds.map((round) => (
        <section key={round} className="flex flex-col gap-2.5">
          <h3 className="text-meta font-medium tracking-wide text-muted uppercase">
            {roundLabel(round)}
          </h3>
          <ul className="flex flex-col gap-2">
            {matches
              .filter((match) => match.round === round)
              .map((match) => {
                const home = match.homeEntryId ? entryById.get(match.homeEntryId) : null;
                const away = match.awayEntryId ? entryById.get(match.awayEntryId) : null;
                const isBye = match.status === "walkover" && (!home || !away);
                const involvesMe =
                  currentUserId !== undefined &&
                  (home?.userId === currentUserId || away?.userId === currentUserId);

                const row = (
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-[var(--radius-control)] border bg-surface px-3.5 py-3",
                      "transition-[border-color,transform] duration-150 ease-(--ease-standard)",
                      involvesMe ? "border-brand/50" : "border-surface-alt/60",
                      !isBye && "hover:-translate-y-px hover:border-brand",
                    )}
                  >
                    <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <span
                        className={cn(
                          "truncate text-right text-body-sm",
                          match.winnerEntryId === match.homeEntryId
                            ? "font-medium text-ink"
                            : "text-muted",
                        )}
                      >
                        {home?.gamertag ?? t("pending")}
                      </span>

                      <span className="tnum shrink-0 rounded-[var(--radius-control)] bg-base px-2.5 py-1 font-display text-body-sm font-bold">
                        {match.homeScore ?? "–"}
                        <span className="mx-1 text-muted">:</span>
                        {match.awayScore ?? "–"}
                      </span>

                      <span
                        className={cn(
                          "truncate text-body-sm",
                          match.winnerEntryId === match.awayEntryId
                            ? "font-medium text-ink"
                            : "text-muted",
                        )}
                      >
                        {isBye ? t("bye") : (away?.gamertag ?? t("pending"))}
                      </span>
                    </div>

                    <Badge tone={MATCH_STATUS_TONE[match.status]} className="hidden sm:inline-flex">
                      {t(STATUS_LABEL[match.status])}
                    </Badge>
                  </div>
                );

                return (
                  <li key={match.id}>
                    {isBye ? (
                      row
                    ) : (
                      <Link href={`/c/${slug}/t/${tournamentId}/m/${match.id}`}>{row}</Link>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}

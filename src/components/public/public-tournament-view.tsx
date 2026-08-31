import { getTranslations } from "next-intl/server";

import { buildStandings } from "@/lib/domain/standings";
import type { PublicTournament } from "@/lib/data/public-view";
import type { Match, MatchStatus } from "@/lib/domain/types";
import { Badge, MATCH_STATUS_TONE } from "@/components/ui/badge";

const STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: "statusScheduled",
  awaiting_confirmation: "statusAwaiting",
  confirmed: "statusConfirmed",
  disputed: "statusDisputed",
  walkover: "statusWalkover",
};

/**
 * Tabla y resultados en modo espectador.
 *
 * Es una vista propia y no una reutilización de las de la app: las de adentro
 * enlazan a perfiles, a la página del partido y a las capturas, y nada de eso
 * existe para quien no tiene cuenta. Compartir componentes acá obligaría a
 * regarlos de condicionales "si hay sesión", que es peor que dos vistas claras.
 */
export async function PublicTournamentView({
  detail,
}: {
  detail: PublicTournament;
}) {
  const t = await getTranslations();
  const isLeague = detail.tournament.format === "league";
  const entryById = new Map(detail.entries.map((entry) => [entry.id, entry]));

  const standings = buildStandings(detail.entries, detail.matches);
  const rounds = [...new Set(detail.matches.map((m) => m.round))].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-8">
      {isLeague && standings.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-subtitle">{t("tournaments.standings")}</h2>

          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-surface-alt/60">
            <table className="w-full min-w-[26rem] border-collapse text-body-sm">
              <caption className="sr-only">{t("tournaments.standings")}</caption>
              <thead>
                <tr className="border-b border-surface-alt/60 bg-surface text-meta tracking-wide text-muted uppercase">
                  <th scope="col" className="w-10 px-3 py-2.5 text-right font-medium">
                    {t("tournaments.tableHead.position")}
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-left font-medium">
                    {t("tournaments.tableHead.player")}
                  </th>
                  <th scope="col" className="w-10 px-2 py-2.5 text-right font-medium">
                    {t("tournaments.tableHead.played")}
                  </th>
                  <th scope="col" className="w-10 px-2 py-2.5 text-right font-medium">
                    {t("tournaments.tableHead.wins")}
                  </th>
                  <th scope="col" className="w-12 px-2 py-2.5 text-right font-medium">
                    {t("tournaments.tableHead.goalDifference")}
                  </th>
                  <th scope="col" className="w-12 px-3 py-2.5 text-right font-medium">
                    {t("tournaments.tableHead.points")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, index) => (
                  <tr
                    key={row.entryId}
                    className="animate-rise border-b border-surface-alt/40 last:border-0"
                    style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
                  >
                    <td className="tnum px-3 py-2.5 text-right font-display font-bold text-muted">
                      {row.rank}
                    </td>
                    <td className="max-w-0 truncate px-3 py-2.5 font-medium">
                      {entryById.get(row.entryId)?.gamertag}
                    </td>
                    <td className="tnum px-2 py-2.5 text-right text-muted">
                      {row.played}
                    </td>
                    <td className="tnum px-2 py-2.5 text-right text-ink">{row.wins}</td>
                    <td className="tnum px-2 py-2.5 text-right text-muted">
                      {row.goalDifference > 0
                        ? `+${row.goalDifference}`
                        : row.goalDifference}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right font-display font-bold text-brand">
                      {row.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-6">
        <h2 className="text-subtitle">{t("tournaments.calendar")}</h2>

        {rounds.map((round) => (
          <div key={round} className="flex flex-col gap-2.5">
            <h3 className="text-meta font-medium tracking-wide text-muted uppercase">
              {isLeague
                ? t("match.matchday", { round })
                : t("match.round", { round })}
            </h3>
            <ul className="flex flex-col gap-2">
              {detail.matches
                .filter((match) => match.round === round)
                .map((match, index) => (
                  <li
                    key={match.id}
                    className="animate-rise"
                    style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
                  >
                    <PublicMatchRow
                      match={match}
                      homeName={
                        match.homeEntryId
                          ? (entryById.get(match.homeEntryId)?.gamertag ??
                            t("match.pending"))
                          : t("match.pending")
                      }
                      awayName={
                        match.awayEntryId
                          ? (entryById.get(match.awayEntryId)?.gamertag ??
                            t("match.pending"))
                          : t("match.bye")
                      }
                      statusLabel={t(`match.${STATUS_LABEL[match.status]}`)}
                    />
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

function PublicMatchRow({
  match,
  homeName,
  awayName,
  statusLabel,
}: {
  match: Match;
  homeName: string;
  awayName: string;
  statusLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-surface-alt/60 bg-surface px-3.5 py-3">
      <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span
          className={`truncate text-right text-body-sm ${
            match.winnerEntryId === match.homeEntryId
              ? "font-medium text-ink"
              : "text-muted"
          }`}
        >
          {homeName}
        </span>
        <span className="tnum shrink-0 rounded-[var(--radius-control)] bg-base px-2.5 py-1 font-display text-body-sm font-bold">
          {match.homeScore ?? "–"}
          <span className="mx-1 text-muted">:</span>
          {match.awayScore ?? "–"}
        </span>
        <span
          className={`truncate text-body-sm ${
            match.winnerEntryId === match.awayEntryId
              ? "font-medium text-ink"
              : "text-muted"
          }`}
        >
          {awayName}
        </span>
      </div>

      <Badge tone={MATCH_STATUS_TONE[match.status]} className="hidden sm:inline-flex">
        {statusLabel}
      </Badge>
    </div>
  );
}

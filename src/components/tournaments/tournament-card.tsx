import { useTranslations } from "next-intl";

import { Badge, LiveDot, TOURNAMENT_STATUS_TONE } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { TournamentRow } from "@/lib/supabase/database.types";

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

export function TournamentCard({
  tournament,
  entryCount,
  slug,
}: {
  tournament: TournamentRow;
  entryCount: number;
  slug: string;
}) {
  const t = useTranslations("tournaments");
  const live = tournament.status === "in_progress";

  return (
    <Link href={`/c/${slug}/t/${tournament.id}`} className="block h-full">
      <Card className="group flex h-full flex-col gap-4 p-5 transition-colors duration-150 ease-(--ease-standard) hover:border-brand/40">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{t(FORMAT_LABEL[tournament.format])}</Badge>
            <Badge tone="neutral">{t(MODE_LABEL[tournament.game_mode])}</Badge>
          </div>
          <Badge tone={TOURNAMENT_STATUS_TONE[tournament.status]}>
            {live && <LiveDot />}
            {t(STATUS_LABEL[tournament.status])}
          </Badge>
        </div>

        <p className="font-display text-subtitle leading-tight text-balance">
          {tournament.name}
        </p>

        {/* Sin tope no hay barra que llenar: se muestra solo el conteo, porque
            una barra al 100% sugeriría un cupo que no existe. */}
        <div className="mt-auto flex items-center gap-3">
          {tournament.size !== null && (
            <ParticipationBar filled={entryCount} total={tournament.size} />
          )}
          <span
            className={`tnum text-meta text-muted ${tournament.size !== null ? "shrink-0" : ""}`}
          >
            {tournament.size !== null
              ? t("registered", { count: entryCount, size: tournament.size })
              : t("registeredOpen", { count: entryCount })}
          </span>
        </div>
      </Card>
    </Link>
  );
}

/** Ocupación del cupo: se lee de un vistazo si falta gente para arrancar. */
function ParticipationBar({ filled, total }: { filled: number; total: number }) {
  const percent = total === 0 ? 0 : Math.min(100, Math.round((filled / total) * 100));
  return (
    <div
      className="h-1.5 flex-1 overflow-hidden rounded-[var(--radius-pill)] bg-surface-alt"
      aria-hidden="true"
    >
      <div
        className="h-full rounded-[var(--radius-pill)] bg-brand transition-[width] duration-500 ease-(--ease-out-quint)"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

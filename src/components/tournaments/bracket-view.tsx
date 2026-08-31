"use client";

import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import type { EntryWithPlayer } from "@/lib/data/tournament";
import type { Match } from "@/lib/domain/types";

/** Alto de una tarjeta de partido y separación vertical, en píxeles. */
const CARD_HEIGHT = 68;
const CARD_GAP = 16;
const COLUMN_WIDTH = 208;
const CONNECTOR_WIDTH = 40;

/**
 * Cuadro de eliminación directa.
 *
 * Las conexiones se dibujan al cargar (400ms por línea, escalonadas 80ms, §8):
 * da la sensación de que el cuadro se arma en vivo, que es exactamente lo que
 * pasa cuando el organizador cierra las inscripciones.
 *
 * El posicionamiento es absoluto sobre una grilla calculada, y no un layout
 * flexible, porque un bracket necesita que cada partido quede centrado entre los
 * dos que lo alimentan — eso no se puede expresar con flexbox.
 */
export function BracketView({
  matches,
  entries,
  slug,
  tournamentId,
  currentUserId,
}: {
  matches: Match[];
  entries: EntryWithPlayer[];
  slug: string;
  tournamentId: string;
  currentUserId?: string;
}) {
  const t = useTranslations("match");
  const reduceMotion = useReducedMotion();

  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const rounds = [...new Set(matches.map((match) => match.round))].sort((a, b) => a - b);
  const firstRoundCount = matches.filter((m) => m.round === rounds[0]).length;

  const totalHeight = firstRoundCount * (CARD_HEIGHT + CARD_GAP);
  const totalWidth = rounds.length * COLUMN_WIDTH;

  /** Centro vertical de un partido: cada ronda duplica la separación. */
  function centerY(round: number, position: number): number {
    const roundIndex = rounds.indexOf(round);
    const span = 2 ** roundIndex;
    const slotHeight = CARD_HEIGHT + CARD_GAP;
    return (position - 1) * span * slotHeight + (span * slotHeight) / 2;
  }

  const connectors = matches
    .filter((match) => match.nextMatchId)
    .map((match, index) => {
      const next = matches.find((m) => m.id === match.nextMatchId);
      if (!next) return null;
      const fromX = rounds.indexOf(match.round) * COLUMN_WIDTH + (COLUMN_WIDTH - CONNECTOR_WIDTH);
      const fromY = centerY(match.round, match.position);
      const toX = rounds.indexOf(next.round) * COLUMN_WIDTH;
      const toY = centerY(next.round, next.position);
      const midX = fromX + CONNECTOR_WIDTH / 2;
      return {
        key: match.id,
        d: `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`,
        delay: rounds.indexOf(match.round) * 0.16 + index * 0.02,
        // La línea del ganador se pinta en el acento: se sigue el camino del que avanza.
        won: match.winnerEntryId !== null,
      };
    })
    .filter((connector): connector is NonNullable<typeof connector> => connector !== null);

  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="relative"
        style={{ width: totalWidth, height: totalHeight, minWidth: "100%" }}
      >
        <svg
          className="pointer-events-none absolute inset-0"
          width={totalWidth}
          height={totalHeight}
          aria-hidden="true"
        >
          {connectors.map((connector) => (
            <motion.path
              key={connector.key}
              d={connector.d}
              fill="none"
              strokeWidth="1.5"
              strokeLinecap="round"
              className={connector.won ? "stroke-brand/70" : "stroke-surface-alt"}
              initial={reduceMotion ? undefined : { pathLength: 0 }}
              animate={reduceMotion ? undefined : { pathLength: 1 }}
              transition={{
                duration: 0.4,
                delay: connector.delay,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          ))}
        </svg>

        {matches.map((match) => (
          <div
            key={match.id}
            className="absolute"
            style={{
              left: rounds.indexOf(match.round) * COLUMN_WIDTH,
              top: centerY(match.round, match.position) - CARD_HEIGHT / 2,
              width: COLUMN_WIDTH - CONNECTOR_WIDTH,
              height: CARD_HEIGHT,
            }}
          >
            <BracketMatch
              match={match}
              entryById={entryById}
              slug={slug}
              tournamentId={tournamentId}
              currentUserId={currentUserId}
              byeLabel={t("bye")}
              pendingLabel={t("pending")}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketMatch({
  match,
  entryById,
  slug,
  tournamentId,
  currentUserId,
  byeLabel,
  pendingLabel,
}: {
  match: Match;
  entryById: Map<string, EntryWithPlayer>;
  slug: string;
  tournamentId: string;
  currentUserId?: string;
  byeLabel: string;
  pendingLabel: string;
}) {
  const home = match.homeEntryId ? entryById.get(match.homeEntryId) : null;
  const away = match.awayEntryId ? entryById.get(match.awayEntryId) : null;
  const isBye = match.status === "walkover" && (!home || !away);
  const involvesMe =
    currentUserId !== undefined &&
    (home?.userId === currentUserId || away?.userId === currentUserId);

  const content = (
    <div
      className={cn(
        "flex h-full flex-col justify-center gap-0.5 rounded-[var(--radius-control)]",
        "border bg-surface px-2.5 py-1.5",
        "transition-[border-color,transform] duration-150 ease-(--ease-standard)",
        match.status === "disputed"
          ? "border-danger/50"
          : match.status === "awaiting_confirmation"
            ? "border-warn/50"
            : involvesMe
              ? "border-brand/50"
              : "border-surface-alt/70",
        !isBye && "hover:-translate-y-px hover:border-brand",
      )}
    >
      <BracketSide
        entry={home}
        score={match.homeScore}
        isWinner={match.winnerEntryId === match.homeEntryId}
        pendingLabel={pendingLabel}
      />
      <BracketSide
        entry={away}
        score={match.awayScore}
        isWinner={match.winnerEntryId === match.awayEntryId}
        pendingLabel={isBye ? byeLabel : pendingLabel}
      />
    </div>
  );

  // Un bye no tiene página propia: no hay resultado que cargar ni disputar.
  return isBye ? (
    content
  ) : (
    <Link href={`/c/${slug}/t/${tournamentId}/m/${match.id}`} className="block h-full">
      {content}
    </Link>
  );
}

function BracketSide({
  entry,
  score,
  isWinner,
  pendingLabel,
}: {
  entry: EntryWithPlayer | null | undefined;
  score: number | null;
  isWinner: boolean;
  pendingLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={cn(
          "truncate text-body-sm",
          entry ? (isWinner ? "font-medium text-ink" : "text-muted") : "text-muted italic",
        )}
      >
        {entry?.gamertag ?? pendingLabel}
      </span>
      <span
        className={cn(
          "tnum shrink-0 text-body-sm",
          isWinner ? "font-display font-bold text-brand" : "text-muted",
        )}
      >
        {score ?? "–"}
      </span>
    </div>
  );
}

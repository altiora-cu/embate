"use client";

import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import type { EntryWithPlayer } from "@/lib/data/tournament";
import type { StandingRow } from "@/lib/domain/types";

/**
 * Tabla de posiciones.
 *
 * Debe seguir siendo legible con 32+ jugadores (§12, criterios de aceptación):
 * en móvil se ocultan las columnas de goles y queda lo que decide la posición
 * (jugados, ganados, puntos), con scroll horizontal como último recurso.
 *
 * Las filas se reordenan con `layout` (§8: 500ms, sin salto brusco). Que la fila
 * viaje hasta su nueva posición en vez de aparecer ahí es lo que deja ver quién
 * subió y quién bajó con el último resultado — que es justo lo que la gente mira
 * cuando entra a la tabla después de un partido.
 */
export function StandingsTable({
  rows,
  slug,
  highlightUserId,
}: {
  rows: (StandingRow & { entry: EntryWithPlayer })[];
  slug: string;
  highlightUserId?: string;
}) {
  const t = useTranslations("tournaments");
  const reduceMotion = useReducedMotion();

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-surface-alt/60">
      <table className="w-full min-w-[34rem] border-collapse text-body-sm">
        <caption className="sr-only">{t("standings")}</caption>
        <thead>
          <tr className="border-b border-surface-alt/60 bg-surface text-meta tracking-wide text-muted uppercase">
            <th scope="col" className="w-10 px-3 py-2.5 text-right font-medium">
              {t("tableHead.position")}
            </th>
            <th scope="col" className="px-3 py-2.5 text-left font-medium">
              {t("tableHead.player")}
            </th>
            <th scope="col" className="w-10 px-2 py-2.5 text-right font-medium">
              {t("tableHead.played")}
            </th>
            <th scope="col" className="w-10 px-2 py-2.5 text-right font-medium">
              {t("tableHead.wins")}
            </th>
            <th
              scope="col"
              className="hidden w-10 px-2 py-2.5 text-right font-medium sm:table-cell"
            >
              {t("tableHead.draws")}
            </th>
            <th
              scope="col"
              className="hidden w-10 px-2 py-2.5 text-right font-medium sm:table-cell"
            >
              {t("tableHead.losses")}
            </th>
            <th
              scope="col"
              className="hidden w-12 px-2 py-2.5 text-right font-medium md:table-cell"
            >
              {t("tableHead.goalsFor")}
            </th>
            <th
              scope="col"
              className="hidden w-12 px-2 py-2.5 text-right font-medium md:table-cell"
            >
              {t("tableHead.goalsAgainst")}
            </th>
            <th scope="col" className="w-12 px-2 py-2.5 text-right font-medium">
              {t("tableHead.goalDifference")}
            </th>
            <th scope="col" className="w-12 px-3 py-2.5 text-right font-medium">
              {t("tableHead.points")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isMe = row.entry.userId === highlightUserId;
            return (
              <motion.tr
                key={row.entryId}
                layout={reduceMotion ? false : "position"}
                transition={{ duration: 0.5, ease: [0.65, 0, 0.35, 1] }}
                style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
                className={cn(
                  "animate-rise border-b border-surface-alt/40 last:border-0",
                  isMe ? "bg-brand/8" : "hover:bg-surface/60",
                )}
              >
                <td className="tnum px-3 py-2.5 text-right font-display font-bold text-muted">
                  {row.rank}
                </td>
                <td className="max-w-0 px-3 py-2.5">
                  <Link
                    href={`/c/${slug}/p/${row.entry.userId}`}
                    className="block truncate font-medium text-ink transition-colors hover:text-brand"
                  >
                    {row.entry.gamertag}
                  </Link>
                </td>
                <td className="tnum px-2 py-2.5 text-right text-muted">{row.played}</td>
                <td className="tnum px-2 py-2.5 text-right text-ink">{row.wins}</td>
                <td className="tnum hidden px-2 py-2.5 text-right text-muted sm:table-cell">
                  {row.draws}
                </td>
                <td className="tnum hidden px-2 py-2.5 text-right text-muted sm:table-cell">
                  {row.losses}
                </td>
                <td className="tnum hidden px-2 py-2.5 text-right text-muted md:table-cell">
                  {row.goalsFor}
                </td>
                <td className="tnum hidden px-2 py-2.5 text-right text-muted md:table-cell">
                  {row.goalsAgainst}
                </td>
                <td className="tnum px-2 py-2.5 text-right text-muted">
                  {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                </td>
                <td className="tnum px-3 py-2.5 text-right font-display font-bold text-brand">
                  {row.points}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>

      <p className="border-t border-surface-alt/60 bg-surface px-3 py-2 text-meta text-muted">
        {t("tableLegend")}
      </p>
    </div>
  );
}

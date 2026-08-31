import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CreateTournamentForm } from "@/components/tournaments/create-tournament-form";

/**
 * Torneo rápido / liga dinámica: crear un torneo sin tocar la pantalla de
 * comunidades. `?f=` preselecciona el formato (league | cup | blitz).
 */

const FORMATS = ["league", "cup", "blitz"] as const;
type QuickFormat = (typeof FORMATS)[number];

function parseFormat(value: string | undefined): QuickFormat {
  return FORMATS.includes(value as QuickFormat) ? (value as QuickFormat) : "blitz";
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("quick");
  return { title: t("title") };
}

export default async function QuickTournamentPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f } = await searchParams;
  const format = parseFormat(f);
  const t = await getTranslations();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-7">
      <div>
        <h1 className="text-section">
          {format === "league" ? t("quick.titleLeague") : t("quick.title")}
        </h1>
        <p className="mt-1.5 text-body-sm text-muted">{t("quick.subtitle")}</p>
      </div>

      <CreateTournamentForm defaultFormat={format} />

      <p className="text-meta text-muted">{t("quick.note")}</p>
    </div>
  );
}

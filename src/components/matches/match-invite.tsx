"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Platform } from "@/lib/domain/types";

const PLATFORM_LABEL: Record<Platform, string> = {
  ps5: "entry.platformPs5",
  xbox: "entry.platformXbox",
  pc: "entry.platformPc",
};

/**
 * Cómo armar el partido dentro del juego.
 *
 * En EA Sports FC un partido no arranca desde acá: alguien tiene que mandarle la
 * invitación al otro desde la consola, y para eso necesita su ID exacto. Ese
 * dato ya lo pedimos al inscribirse, así que lo único sensato es ponerlo grande,
 * con un botón de copiar, en la pantalla donde el jugador va a estar mirando.
 *
 * El aviso de crossplay no es un detalle: si uno está en PS5 y el otro en Xbox,
 * la invitación no llega hasta que ambos lo activen en los ajustes del juego, y
 * es el motivo más común de un partido que "no se pudo jugar".
 */
export function MatchInvite({
  rivalName,
  rivalGamertag,
  rivalPlatform,
  myPlatform,
}: {
  rivalName: string;
  rivalGamertag: string;
  rivalPlatform: Platform;
  myPlatform: Platform | null;
}) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);

  const crossplay = myPlatform !== null && myPlatform !== rivalPlatform;
  const platformLabel = t(PLATFORM_LABEL[rivalPlatform]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(rivalGamertag);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles el ID sigue visible para copiarlo a mano.
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-brand/30 bg-brand/5 px-5 py-5">
      <div>
        <h2 className="text-subtitle">{t("match.inviteTitle")}</h2>
        <p className="mt-1 max-w-prose text-body-sm text-muted">
          {t("match.inviteBody")}
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 rounded-[var(--radius-control)] border border-surface-alt bg-base px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-meta tracking-wide text-muted uppercase">
            {t("match.inviteRival", { name: rivalName })}
          </p>
          {/* Monoespaciado y seleccionable: un ID mal tipeado es un partido que no
              se juega, así que tiene que poder leerse carácter por carácter. */}
          <p className="mt-1 font-display text-section leading-tight break-all text-brand select-all">
            {rivalGamertag}
          </p>
          <Badge className="mt-2">{t("match.invitePlatform", { platform: platformLabel })}</Badge>
        </div>

        <Button variant="secondary" size="sm" onClick={copy}>
          {copied ? t("common.copied") : t("match.inviteCopy")}
        </Button>
      </div>

      {crossplay ? (
        <p className="flex gap-2 text-body-sm text-warn">
          <span aria-hidden="true">⚠</span>
          {t("match.inviteCrossplay")}
        </p>
      ) : (
        myPlatform && (
          <p className="text-meta text-muted">
            {t("match.inviteSamePlatform", { platform: platformLabel })}
          </p>
        )
      )}
    </div>
  );
}

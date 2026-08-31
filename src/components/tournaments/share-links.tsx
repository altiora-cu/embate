"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * Enlaces para compartir un torneo.
 *
 * Son dos cosas distintas y conviene no mezclarlas:
 *
 * - **Invitación**: un enlace por torneo que hace todo de una. Quien lo abre se
 *   une a la comunidad y cae directo en la pantalla de inscripción de ESE torneo.
 *   Sin él, invitar significa "entrá con este código, buscá la comunidad, buscá
 *   el torneo, anotate" — cuatro pasos donde se pierde gente.
 * - **Público**: solo lectura, sin cuenta, para el que quiere mirar cómo va.
 *   Solo aparece si el organizador activó la página pública.
 *
 * Las URL llegan ya armadas desde el servidor, que conoce el host real del
 * request. Construirlas en el cliente con `window.location.origin` obligaría a
 * un efecto y dejaría el enlace vacío en el primer render — justo cuando el
 * organizador lo va a copiar.
 */
export function ShareLinks({
  inviteUrl,
  publicUrl,
}: {
  inviteUrl: string;
  /** `null` cuando la comunidad todavía no publicó su página. */
  publicUrl: string | null;
}) {
  const t = useTranslations("tournaments");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <CopyableLink
        label={t("inviteLink")}
        hint={t("inviteLinkHint")}
        url={inviteUrl}
        tone="brand"
      />
      {publicUrl && (
        <CopyableLink
          label={t("publicLink")}
          hint={t("publicLinkHint")}
          url={publicUrl}
          tone="neutral"
        />
      )}
    </div>
  );
}

function CopyableLink({
  label,
  hint,
  url,
  tone,
}: {
  label: string;
  hint: string;
  url: string;
  tone: "brand" | "neutral";
}) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin portapapeles el enlace sigue visible y seleccionable.
    }
  }

  return (
    <div
      className={`flex flex-col gap-2 rounded-[var(--radius-control)] border px-4 py-3 ${
        tone === "brand" ? "border-brand/30 bg-brand/5" : "border-surface-alt bg-base"
      }`}
    >
      <p className="text-meta tracking-wide text-muted uppercase">{label}</p>
      {/* `select-all` y `break-all`: el enlace se copia con el botón, pero también
          tiene que poder seleccionarse a mano si el portapapeles falla. */}
      <p className="text-meta break-all text-ink select-all">{url || "…"}</p>
      <p className="text-meta text-muted">{hint}</p>
      <Button
        variant="secondary"
        size="sm"
        onClick={copy}
        disabled={!url}
        className="mt-1 w-fit"
      >
        {copied ? t("copied") : t("copy")}
      </Button>
    </div>
  );
}

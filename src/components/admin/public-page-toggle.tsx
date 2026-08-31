"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { setCommunityVisibilityAction } from "@/lib/actions/communities";

/**
 * Interruptor de la página pública de la comunidad.
 *
 * Arranca apagado y se enciende a mano. La explicación de qué se expone va
 * SIEMPRE visible y no escondida tras un icono de ayuda: el organizador está
 * decidiendo publicar los gamertags y los resultados de terceros, y tiene que
 * poder leer eso antes de tocar el botón, no después.
 */
export function PublicPageToggle({
  communityId,
  slug,
  initialIsPublic,
  publicUrl,
}: {
  communityId: string;
  slug: string;
  initialIsPublic: boolean;
  /** URL absoluta ya resuelta en el servidor, que conoce el host real. */
  publicUrl: string;
}) {
  const t = useTranslations();
  const toast = useToast();
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function toggle() {
    const next = !isPublic;
    startTransition(async () => {
      const result = await setCommunityVisibilityAction(communityId, slug, next);
      if (result.ok) {
        setIsPublic(next);
        toast.show(t("common.saved"), "success");
      } else {
        toast.show(t(result.error), "danger");
      }
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // El enlace queda visible para copiarlo a mano.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-2 text-body-sm font-medium ${
            isPublic ? "text-brand" : "text-muted"
          }`}
        >
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${isPublic ? "bg-brand" : "bg-surface-alt"}`}
          />
          {isPublic ? t("admin.publicPageOn") : t("admin.publicPageOff")}
        </span>

        <Button
          variant={isPublic ? "secondary" : "primary"}
          size="sm"
          loading={pending}
          onClick={toggle}
          aria-pressed={isPublic}
        >
          {isPublic ? t("admin.publicPageOff") : t("admin.publicPageOn")}
        </Button>
      </div>

      <p className="text-meta leading-relaxed text-muted">
        {t("admin.publicPageHint")}
      </p>

      {isPublic && (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] border border-surface-alt bg-base px-3.5 py-3">
          <p className="min-w-0 flex-1 text-meta break-all text-ink select-all">
            {publicUrl}
          </p>
          <Button variant="ghost" size="sm" onClick={copyLink}>
            {copied ? t("common.copied") : t("common.copy")}
          </Button>
        </div>
      )}
    </div>
  );
}

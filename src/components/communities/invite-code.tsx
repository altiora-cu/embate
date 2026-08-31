"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * Código de invitación con copiado al portapapeles.
 * El organizador lo va a pegar en Discord decenas de veces: que sea un solo toque.
 */
export function InviteCode({ code }: { code: string }) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles el código sigue visible para copiarlo a mano.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border border-surface-alt/60 bg-surface px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-meta tracking-wide text-muted uppercase">
          {t("communities.inviteCode")}
        </p>
        <p className="mt-1 font-display text-section tracking-[0.2em] text-brand">
          {code}
        </p>
        <p className="mt-1 text-meta text-muted">{t("communities.inviteCodeHint")}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={copy}>
        {copied ? t("common.copied") : t("common.copy")}
      </Button>
    </div>
  );
}

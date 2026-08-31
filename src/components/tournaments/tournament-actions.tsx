"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  closeRegistrationAction,
  finishTournamentAction,
} from "@/lib/actions/tournaments";

/**
 * Acciones del organizador sobre el torneo.
 *
 * Cerrar inscripciones es irreversible (genera los cruces), así que pide una
 * confirmación explícita en vez de disparar con un solo clic.
 */
export function CloseRegistrationButton({
  tournamentId,
  slug,
  disabled,
}: {
  tournamentId: string;
  slug: string;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await closeRegistrationAction(tournamentId, slug);
      if (!result.ok) {
        setError(result.error);
        setArmed(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {armed ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" loading={pending} onClick={run}>
            {t("common.confirm")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setArmed(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      ) : (
        <Button size="sm" disabled={disabled} onClick={() => setArmed(true)}>
          {t("tournaments.closeRegistration")}
        </Button>
      )}

      <p className="text-meta text-muted">{t("tournaments.closeRegistrationHint")}</p>

      {error && (
        <p role="alert" className="text-meta text-danger">
          {t(error)}
        </p>
      )}
    </div>
  );
}

export function FinishTournamentButton({
  tournamentId,
  slug,
}: {
  tournamentId: string;
  slug: string;
}) {
  const t = useTranslations("tournaments");
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      onClick={() =>
        startTransition(() => void finishTournamentAction(tournamentId, slug))
      }
    >
      {t("finish")}
    </Button>
  );
}

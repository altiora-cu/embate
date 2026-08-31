"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { FormState } from "@/lib/actions/communities";
import { confirmMatchAction, openDisputeAction } from "@/lib/actions/matches";

const INITIAL: FormState = { status: "idle" };

/**
 * Segunda mitad de la doble confirmación (§4.5).
 *
 * Las dos salidas están al mismo nivel visual a propósito: si "confirmar" fuera
 * el único botón evidente, la gente aceptaría resultados equivocados por inercia,
 * y el sistema de disputas —que es el que sostiene la confianza— quedaría muerto.
 */
export function ConfirmPanel({
  matchId,
  tournamentId,
  slug,
  reportedBy,
  homeName,
  awayName,
  homeScore,
  awayScore,
}: {
  matchId: string;
  tournamentId: string;
  slug: string;
  reportedBy: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
}) {
  const t = useTranslations();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [disputing, setDisputing] = useState(false);

  const disputeAction = openDisputeAction.bind(null, { matchId, tournamentId, slug });
  const [disputeState, disputeFormAction, disputePending] = useActionState(
    disputeAction,
    INITIAL,
  );

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmMatchAction(matchId, tournamentId, slug);
      if (result.ok) {
        // §8: el resultado en firme se avisa con un toast en el acento de marca.
        toast.show(t("match.statusConfirmed"), "success");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-body-sm text-muted">
          {t("match.rivalReported", { name: reportedBy })}
        </p>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[var(--radius-control)] border border-surface-alt bg-base px-4 py-4">
          <span className="truncate text-right text-body-sm text-muted">{homeName}</span>
          <span className="tnum font-display text-section font-bold">
            {homeScore}
            <span className="mx-2 text-muted">:</span>
            {awayScore}
          </span>
          <span className="truncate text-body-sm text-muted">{awayName}</span>
        </div>
      </div>

      {disputing ? (
        <form action={disputeFormAction} className="flex flex-col gap-4" noValidate>
          <p className="text-body-sm text-muted">{t("match.disputeSubtitle")}</p>
          <Field
            label={t("match.disputeReason")}
            htmlFor="reason"
            error={
              disputeState.status === "error" && disputeState.fields?.reason
                ? t(disputeState.fields.reason, { count: 3 })
                : undefined
            }
          >
            <Textarea
              id="reason"
              name="reason"
              placeholder={t("match.disputeReasonPlaceholder")}
              required
              minLength={3}
              maxLength={1000}
            />
          </Field>

          {disputeState.status === "error" && !disputeState.fields && (
            <p role="alert" className="text-body-sm text-danger">
              {t(disputeState.error)}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" loading={disputePending}>
              {t("match.submitDispute")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDisputing(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <Button size="lg" loading={pending} onClick={confirm}>
            {t("match.confirmResult")}
          </Button>
          <p className="text-meta text-muted">{t("match.confirmResultHint")}</p>

          <Button variant="danger" onClick={() => setDisputing(true)}>
            {t("match.disputeResult")}
          </Button>

          {error && (
            <p role="alert" className="text-body-sm text-danger">
              {t(error)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

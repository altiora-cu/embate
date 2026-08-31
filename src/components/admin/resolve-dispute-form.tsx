"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { FormState } from "@/lib/actions/communities";
import { resolveDisputeAction } from "@/lib/actions/matches";

const INITIAL: FormState = { status: "idle" };

/**
 * Resolución de una disputa por el administrador (§4.6).
 *
 * "Darle la razón" o "rechazar" no es una formalidad: esa decisión alimenta el
 * componente de integridad de la calificación de 5 estrellas, así que se pide
 * de forma explícita y no se deduce del marcador que cargue el admin.
 */
export function ResolveDisputeForm({
  disputeId,
  slug,
  homeName,
  awayName,
  suggestedHome,
  suggestedAway,
}: {
  disputeId: string;
  slug: string;
  homeName: string;
  awayName: string;
  suggestedHome: number;
  suggestedAway: number;
}) {
  const t = useTranslations();
  const action = resolveDisputeAction.bind(null, { disputeId, slug });
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [uphold, setUphold] = useState(true);
  const toast = useToast();

  // El aviso se dispara al pasar el estado a `success`, y no dentro de la acción:
  // la acción corre en el servidor y no puede tocar la interfaz.
  useEffect(() => {
    if (state.status === "success") toast.show(t("admin.resolved"), "success");
  }, [state, toast, t]);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="uphold" value={String(uphold)} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-body-sm font-medium text-ink">
          {t("admin.finalScore")}
        </legend>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="truncate text-meta text-muted">{homeName}</span>
            <Input
              name="homeScore"
              type="number"
              min={0}
              max={99}
              inputMode="numeric"
              defaultValue={suggestedHome}
              required
              className="tnum text-center font-display text-subtitle"
              aria-label={homeName}
            />
          </label>
          <span aria-hidden="true" className="pt-6 text-muted">
            :
          </span>
          <label className="flex flex-col gap-1.5">
            <span className="truncate text-meta text-muted">{awayName}</span>
            <Input
              name="awayScore"
              type="number"
              min={0}
              max={99}
              inputMode="numeric"
              defaultValue={suggestedAway}
              required
              className="tnum text-center font-display text-subtitle"
              aria-label={awayName}
            />
          </label>
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setUphold(true)}
          aria-pressed={uphold}
          className={`rounded-[var(--radius-control)] border px-4 py-3 text-left text-body-sm transition-colors duration-150 ease-(--ease-standard) ${
            uphold ? "border-brand bg-brand/10 text-brand" : "border-surface-alt text-muted"
          }`}
        >
          {t("admin.uphold")}
        </button>
        <button
          type="button"
          onClick={() => setUphold(false)}
          aria-pressed={!uphold}
          className={`rounded-[var(--radius-control)] border px-4 py-3 text-left text-body-sm transition-colors duration-150 ease-(--ease-standard) ${
            !uphold ? "border-danger bg-danger/10 text-danger" : "border-surface-alt text-muted"
          }`}
        >
          {t("admin.reject")}
        </button>
      </div>

      <Field label={t("admin.resolutionNote")} htmlFor={`note-${disputeId}`}>
        <Textarea
          id={`note-${disputeId}`}
          name="note"
          placeholder={t("admin.resolutionNotePlaceholder")}
          maxLength={1000}
        />
      </Field>

      {state.status === "error" && (
        <p role="alert" className="text-body-sm text-danger">
          {t(state.error)}
        </p>
      )}
      {/* El éxito lo comunica el toast: repetirlo acá sería anunciarlo dos veces
          a un lector de pantalla, porque ambos usan `role="status"`. */}

      <Button type="submit" loading={pending}>
        {t("admin.resolve")}
      </Button>
    </form>
  );
}

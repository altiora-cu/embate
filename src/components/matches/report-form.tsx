"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { FormState } from "@/lib/actions/communities";
import { submitReportAction } from "@/lib/actions/matches";
import {
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_MIME_TYPES,
} from "@/lib/validation/schemas";

const INITIAL: FormState = { status: "idle" };

/**
 * Carga del resultado con captura (§4.5).
 *
 * El archivo se valida en el navegador antes de subirlo: avisar del límite de
 * 8 MB después de esperar la subida completa desde datos móviles es la peor
 * versión posible de este flujo.
 */
export function ReportForm({
  context,
  homeName,
  awayName,
}: {
  context: {
    matchId: string;
    tournamentId: string;
    communityId: string;
    slug: string;
  };
  homeName: string;
  awayName: string;
}) {
  const t = useTranslations();
  const action = submitReportAction.bind(null, context);
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function validateFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileName(file?.name ?? null);

    if (!file) {
      setFileError(null);
      return;
    }
    if (file.size > SCREENSHOT_MAX_BYTES) {
      setFileError("errors.fileTooLarge");
      event.target.value = "";
      setFileName(null);
      return;
    }
    if (!SCREENSHOT_MIME_TYPES.includes(file.type as (typeof SCREENSHOT_MIME_TYPES)[number])) {
      setFileError("errors.fileType");
      event.target.value = "";
      setFileName(null);
      return;
    }
    setFileError(null);
  }

  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-body-sm font-medium text-ink">
          {t("match.yourScore")}
        </legend>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="truncate text-meta text-muted">{homeName}</span>
            <Input
              name="homeScore"
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              defaultValue={0}
              required
              className="tnum text-center font-display text-section"
              aria-label={homeName}
            />
          </label>

          <span aria-hidden="true" className="pt-6 font-display text-section text-muted">
            :
          </span>

          <label className="flex flex-col gap-1.5">
            <span className="truncate text-meta text-muted">{awayName}</span>
            <Input
              name="awayScore"
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              defaultValue={0}
              required
              className="tnum text-center font-display text-section"
              aria-label={awayName}
            />
          </label>
        </div>

        {(fields.homeScore || fields.awayScore) && (
          <p role="alert" className="text-meta text-danger">
            {t("validation.score")}
          </p>
        )}
      </fieldset>

      <Field
        label={t("match.screenshot")}
        htmlFor="screenshot"
        hint={t("match.screenshotHint")}
        error={fileError ? t(fileError) : undefined}
      >
        <input
          id="screenshot"
          name="screenshot"
          type="file"
          accept={SCREENSHOT_MIME_TYPES.join(",")}
          // `capture` deja que el celular ofrezca la cámara directamente.
          onChange={validateFile}
          className="w-full rounded-[var(--radius-control)] border border-surface-alt bg-base px-3 py-2.5 text-body-sm text-muted file:mr-3 file:rounded-[var(--radius-control)] file:border-0 file:bg-surface-alt file:px-3 file:py-1.5 file:text-body-sm file:text-ink hover:file:bg-surface-alt/70"
        />
      </Field>

      {fileName && <p className="-mt-2 truncate text-meta text-brand">{fileName}</p>}

      {state.status === "error" && !state.fields && (
        <p role="alert" className="text-body-sm text-danger">
          {t(state.error)}
        </p>
      )}

      <Button type="submit" size="lg" loading={pending}>
        {t("match.submitReport")}
      </Button>
    </form>
  );
}

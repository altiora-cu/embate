"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Field, Input, RadioCard } from "@/components/ui/field";
import type { FormState } from "@/lib/actions/communities";
import { createTournamentAction, quickTournamentAction } from "@/lib/actions/tournaments";

const INITIAL: FormState = { status: "idle" };

/**
 * Creación de torneo.
 *
 * El cupo y el plazo de inscripción son OPCIONALES: un torneo no arranca por
 * llenarse ni por vencer una fecha, arranca cuando el organizador cierra las
 * inscripciones y sortea. Poner un tope es una herramienta que él decide usar,
 * no una condición del sistema.
 *
 * Sin `communityId`/`slug` el formulario opera en modo rápido: la acción del
 * servidor resuelve (o crea) la comunidad personal del usuario por su cuenta.
 */
export function CreateTournamentForm({
  communityId,
  slug,
  defaultFormat = "league",
}: {
  communityId?: string;
  slug?: string;
  defaultFormat?: "league" | "cup" | "blitz";
}) {
  const t = useTranslations();
  const action =
    communityId && slug
      ? createTournamentAction.bind(null, communityId, slug)
      : quickTournamentAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [capped, setCapped] = useState(false);
  // Se sigue el formato elegido para mostrar las vueltas solo en liga:
  // preguntar "¿ida y vuelta?" en una copa sería ruido.
  const [format, setFormat] = useState<string>(defaultFormat);

  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <Field
        label={t("tournaments.name")}
        htmlFor="name"
        error={fields.name && t(fields.name, { count: 2 })}
      >
        <Input
          id="name"
          name="name"
          placeholder={t("tournaments.namePlaceholder")}
          required
        />
      </Field>

      <fieldset
        className="flex flex-col gap-2"
        onChange={(event) => {
          const target = event.target;
          if (target instanceof HTMLInputElement && target.name === "format") {
            setFormat(target.value);
          }
        }}
      >
        <legend className="mb-1 text-body-sm font-medium text-ink">
          {t("tournaments.format")}
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          <RadioCard
            name="format"
            value="league"
            title={t("tournaments.formatLeague")}
            description={t("tournaments.formatLeagueHint")}
            defaultChecked={defaultFormat === "league"}
          />
          <RadioCard
            name="format"
            value="cup"
            title={t("tournaments.formatCup")}
            description={t("tournaments.formatCupHint")}
            defaultChecked={defaultFormat === "cup"}
          />
          <RadioCard
            name="format"
            value="blitz"
            title={t("tournaments.formatBlitz")}
            description={t("tournaments.formatBlitzHint")}
            defaultChecked={defaultFormat === "blitz"}
          />
        </div>
      </fieldset>

      {format === "league" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-body-sm font-medium text-ink">
            {t("tournaments.legs")}
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <RadioCard
              name="legs"
              value="1"
              title={t("tournaments.legsOne")}
              description={t("tournaments.legsOneHint")}
              defaultChecked
            />
            <RadioCard
              name="legs"
              value="2"
              title={t("tournaments.legsTwo")}
              description={t("tournaments.legsTwoHint")}
            />
          </div>
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-body-sm font-medium text-ink">
          {t("tournaments.gameMode")}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <RadioCard
            name="gameMode"
            value="ultimate_team"
            title={t("tournaments.gameModeUltimate")}
            defaultChecked
          />
          <RadioCard
            name="gameMode"
            value="kick_off"
            title={t("tournaments.gameModeKickOff")}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-body-sm font-medium text-ink">
          {t("tournaments.size")}
        </legend>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setCapped(false)}
            aria-pressed={!capped}
            className={`rounded-[var(--radius-control)] border px-4 py-3 text-left text-body-sm transition-colors duration-150 ease-(--ease-standard) ${
              !capped
                ? "border-brand bg-brand/10 text-brand"
                : "border-surface-alt text-muted hover:border-muted/50"
            }`}
          >
            {t("tournaments.sizeUnlimited")}
          </button>
          <button
            type="button"
            onClick={() => setCapped(true)}
            aria-pressed={capped}
            className={`rounded-[var(--radius-control)] border px-4 py-3 text-left text-body-sm transition-colors duration-150 ease-(--ease-standard) ${
              capped
                ? "border-brand bg-brand/10 text-brand"
                : "border-surface-alt text-muted hover:border-muted/50"
            }`}
          >
            {t("tournaments.sizeCustom")}
          </button>
        </div>

        {/* Sin tope no se manda ningún número: el campo vacío llega como `null`. */}
        {capped && (
          <Input
            name="size"
            type="number"
            inputMode="numeric"
            min={2}
            defaultValue={16}
            aria-label={t("tournaments.size")}
            className="tnum mt-1 max-w-40"
          />
        )}

        <p className="text-meta text-muted">{t("tournaments.sizeHint")}</p>
      </fieldset>

      <Field
        label={`${t("tournaments.registrationCloses")} (${t("common.optional")})`}
        htmlFor="registrationClosesAt"
        hint={t("tournaments.registrationClosesHint")}
      >
        <Input
          id="registrationClosesAt"
          name="registrationClosesAt"
          type="datetime-local"
        />
      </Field>

      <Field
        label={`${t("tournaments.startsAt")} (${t("common.optional")})`}
        htmlFor="startsAt"
      >
        <Input id="startsAt" name="startsAt" type="datetime-local" />
      </Field>

      {state.status === "error" && !state.fields && (
        <p role="alert" className="text-body-sm text-danger">
          {t(state.error)}
        </p>
      )}

      <Button type="submit" size="lg" loading={pending}>
        {t("tournaments.createTitle")}
      </Button>
    </form>
  );
}

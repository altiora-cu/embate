"use client";

import { useActionState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Field, Input, RadioCard } from "@/components/ui/field";
import type { FormState } from "@/lib/actions/communities";
import { registerAction, unregisterAction } from "@/lib/actions/tournaments";
import type { Platform } from "@/lib/domain/types";

const INITIAL: FormState = { status: "idle" };

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "ps5", label: "entry.platformPs5" },
  { value: "xbox", label: "entry.platformXbox" },
  { value: "pc", label: "entry.platformPc" },
];

export function RegisterForm({
  tournamentId,
  slug,
  defaultGamertag,
  defaultPlatform,
}: {
  tournamentId: string;
  slug: string;
  defaultGamertag?: string | null;
  defaultPlatform?: Platform | null;
}) {
  const t = useTranslations();
  const action = registerAction.bind(null, tournamentId, slug);
  const [state, formAction, pending] = useActionState(action, INITIAL);

  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Field
        label={t("entry.gamertag")}
        htmlFor="gamertag"
        hint={t("entry.gamertagHint")}
        error={fields.gamertag && t(fields.gamertag, { count: 2 })}
      >
        <Input
          id="gamertag"
          name="gamertag"
          defaultValue={defaultGamertag ?? ""}
          autoComplete="off"
          spellCheck={false}
          required
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-body-sm font-medium text-ink">
          {t("entry.platform")}
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {PLATFORMS.map((platform, index) => (
            <RadioCard
              key={platform.value}
              name="platform"
              value={platform.value}
              title={t(platform.label)}
              defaultChecked={
                defaultPlatform ? defaultPlatform === platform.value : index === 0
              }
            />
          ))}
        </div>
      </fieldset>

      {state.status === "error" && !state.fields && (
        <p role="alert" className="text-body-sm text-danger">
          {t(state.error)}
        </p>
      )}

      <Button type="submit" loading={pending}>
        {t("entry.submit")}
      </Button>
    </form>
  );
}

/** Baja voluntaria, disponible solo mientras las inscripciones sigan abiertas. */
export function UnregisterButton({
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
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(() => void unregisterAction(tournamentId, slug))
      }
    >
      {t("unregister")}
    </Button>
  );
}

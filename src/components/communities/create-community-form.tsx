"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createCommunityAction, type FormState } from "@/lib/actions/communities";
import { slugify } from "@/lib/validation/schemas";

const INITIAL: FormState = { status: "idle" };

/** Paleta de arranque para el acento del organizador (white-label básico). */
const PRESET_ACCENTS = ["#C6FF3D", "#2E5CFF", "#FF4D4D", "#FFB020", "#A78BFA", "#22D3EE"];

export function CreateCommunityForm() {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(createCommunityAction, INITIAL);

  // El slug se propone solo desde el nombre, pero se puede editar: obligar a
  // escribirlo dos veces es fricción sin motivo.
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [accent, setAccent] = useState(PRESET_ACCENTS[0]);

  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Field
        label={t("communities.name")}
        htmlFor="name"
        error={fields.name && t(fields.name, { count: 2 })}
      >
        <Input
          id="name"
          name="name"
          value={name}
          placeholder={t("communities.namePlaceholder")}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugEdited) setSlug(slugify(event.target.value));
          }}
          required
        />
      </Field>

      <Field
        label={t("communities.slug")}
        htmlFor="slug"
        hint={t("communities.slugHint")}
        error={fields.slug && t(fields.slug, { count: 3 })}
      >
        <div className="flex items-center gap-1.5 rounded-[var(--radius-control)] border border-surface-alt bg-base px-3">
          <span className="shrink-0 text-body-sm text-muted">embate.app/c/</span>
          <input
            id="slug"
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(slugify(event.target.value));
            }}
            className="w-full bg-transparent py-2.5 text-body text-ink focus:outline-none"
            required
          />
        </div>
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-body-sm font-medium text-ink">
          {t("communities.accent")}
        </legend>
        <p className="text-meta text-muted">{t("communities.accentHint")}</p>
        <input type="hidden" name="brandAccent" value={accent} />
        <div className="mt-1 flex flex-wrap gap-2">
          {PRESET_ACCENTS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setAccent(color)}
              aria-label={color}
              aria-pressed={accent === color}
              className="size-9 rounded-[var(--radius-control)] border-2 transition-transform duration-150 ease-(--ease-standard) hover:scale-105"
              style={{
                backgroundColor: color,
                borderColor: accent === color ? "var(--color-ink)" : "transparent",
              }}
            />
          ))}
        </div>
      </fieldset>

      {state.status === "error" && !state.fields && (
        <p role="alert" className="text-body-sm text-danger">
          {t(state.error)}
        </p>
      )}

      <Button type="submit" size="lg" loading={pending}>
        {t("communities.createTitle")}
      </Button>
    </form>
  );
}

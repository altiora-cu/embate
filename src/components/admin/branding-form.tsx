"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { updateBrandingAction, type FormState } from "@/lib/actions/communities";
import { contrastInk } from "@/lib/utils/color";

const INITIAL: FormState = { status: "idle" };

/**
 * Marca blanca básica del MVP (§4, ítem 12).
 * La vista previa muestra el botón con el color elegido y su tinta calculada:
 * el organizador ve al instante si su color deja el texto ilegible.
 */
export function BrandingForm({
  communityId,
  slug,
  defaultName,
  defaultAccent,
  defaultLogoUrl,
}: {
  communityId: string;
  slug: string;
  defaultName: string;
  defaultAccent: string;
  defaultLogoUrl: string | null;
}) {
  const t = useTranslations();
  const action = updateBrandingAction.bind(null, communityId, slug);
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [accent, setAccent] = useState(defaultAccent);
  const toast = useToast();

  // Se avisa al pasar el estado a `success`: la acción corre en el servidor y
  // no puede mostrar nada por sí misma.
  useEffect(() => {
    if (state.status === "success") toast.show(t("common.saved"), "success");
  }, [state, toast, t]);

  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Field
        label={t("communities.name")}
        htmlFor="brand-name"
        error={fields.name && t(fields.name, { count: 2 })}
      >
        <Input id="brand-name" name="name" defaultValue={defaultName} required />
      </Field>

      <Field
        label={t("communities.accent")}
        htmlFor="brandAccent"
        hint={t("communities.accentHint")}
        error={fields.brandAccent && t("validation.color")}
      >
        <div className="flex items-center gap-3">
          <input
            id="brandAccent"
            name="brandAccent"
            type="color"
            value={accent}
            onChange={(event) => setAccent(event.target.value.toUpperCase())}
            className="size-11 shrink-0 cursor-pointer rounded-[var(--radius-control)] border border-surface-alt bg-base"
          />
          <span className="tnum font-display text-body-sm tracking-wider text-muted">
            {accent.toUpperCase()}
          </span>
          <span
            className="ml-auto inline-flex h-9 items-center rounded-[var(--radius-control)] px-4 text-body-sm font-medium"
            style={{ backgroundColor: accent, color: contrastInk(accent) }}
          >
            {t("common.save")}
          </span>
        </div>
      </Field>

      <Field
        label={`${t("admin.logoUrl")} (${t("common.optional")})`}
        htmlFor="logoUrl"
        error={fields.logoUrl && t("validation.required")}
      >
        <Input
          id="logoUrl"
          name="logoUrl"
          type="url"
          inputMode="url"
          defaultValue={defaultLogoUrl ?? ""}
          placeholder="https://"
        />
      </Field>

      {state.status === "error" && !state.fields && (
        <p role="alert" className="text-body-sm text-danger">
          {t(state.error)}
        </p>
      )}
      {/* El éxito lo comunica el toast; duplicarlo acá lo anunciaría dos veces. */}

      <Button type="submit" loading={pending}>
        {t("common.save")}
      </Button>
    </form>
  );
}

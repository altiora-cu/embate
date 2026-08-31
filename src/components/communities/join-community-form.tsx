"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { joinCommunityAction, type FormState } from "@/lib/actions/communities";

const INITIAL: FormState = { status: "idle" };

export function JoinCommunityForm({ defaultCode = "" }: { defaultCode?: string }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(joinCommunityAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Field label={t("communities.code")} htmlFor="code">
        <Input
          id="code"
          name="code"
          defaultValue={defaultCode}
          placeholder={t("communities.codePlaceholder")}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={16}
          required
          // El código se dicta y se copia a mano: mayúsculas grandes y espaciadas
          // para que no se confunda un carácter al teclearlo desde el celular.
          className="text-center font-display text-section tracking-[0.3em] uppercase"
        />
      </Field>

      {state.status === "error" && (
        <p role="alert" className="text-body-sm text-danger">
          {t(state.error)}
        </p>
      )}

      <Button type="submit" size="lg" loading={pending}>
        {t("communities.join")}
      </Button>
    </form>
  );
}

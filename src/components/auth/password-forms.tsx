"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  requestPasswordResetAction,
  updatePasswordAction,
  type AuthState,
} from "@/lib/actions/auth";

const INITIAL: AuthState = { status: "idle" };

/** Pide el enlace de recuperación. */
export function ForgotPasswordForm() {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    INITIAL,
  );

  if (state.status === "check_email") {
    return (
      <div className="rounded-[var(--radius-card)] border border-brand/30 bg-brand/5 p-5">
        <p className="font-display text-subtitle text-brand">{t("auth.forgotSent")}</p>
        <p className="mt-2 text-body-sm text-muted">{t("auth.forgotSentBody")}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Field label={t("auth.email")} htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
        />
      </Field>

      {state.status === "error" && (
        <p role="alert" className="text-body-sm text-danger">
          {t(state.error)}
        </p>
      )}

      <Button type="submit" size="lg" loading={pending}>
        {t("auth.forgotSubmit")}
      </Button>
    </form>
  );
}

/** Guarda la contraseña nueva. Solo funciona con la sesión del enlace del correo. */
export function ResetPasswordForm() {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(updatePasswordAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Field
        label={t("auth.newPassword")}
        htmlFor="password"
        hint={t("auth.passwordHint")}
        error={
          state.status === "error" && state.fields?.password
            ? t("validation.min", { count: 8 })
            : undefined
        }
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>

      {state.status === "error" && !state.fields && (
        <p role="alert" className="text-body-sm text-danger">
          {t(state.error)}
        </p>
      )}

      <Button type="submit" size="lg" loading={pending}>
        {t("auth.resetSubmit")}
      </Button>
    </form>
  );
}

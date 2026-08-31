"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { signInAction, signUpAction, type AuthState } from "@/lib/actions/auth";

const INITIAL: AuthState = { status: "idle" };

export function AuthForm({
  mode,
  next,
}: {
  mode: "signin" | "signup";
  /** Ruta a la que volver tras entrar. La valida el servidor. */
  next?: string;
}) {
  const t = useTranslations();
  const isSignUp = mode === "signup";
  const [state, formAction, pending] = useActionState(
    isSignUp ? signUpAction : signInAction,
    INITIAL,
  );

  if (state.status === "check_email") {
    return (
      <div className="rounded-[var(--radius-card)] border border-brand/30 bg-brand/5 p-5">
        <p className="font-display text-subtitle text-brand">{t("auth.checkEmail")}</p>
        <p className="mt-2 text-body-sm text-muted">{t("auth.checkEmailBody")}</p>
      </div>
    );
  }

  const fields = state.status === "error" ? (state.fields ?? {}) : {};
  // Tras un error, React 19 resetea el formulario a sus defaultValue: se
  // rellenan con lo que el usuario había escrito para que no lo pierda.
  const values = state.status === "error" ? (state.values ?? {}) : {};

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {isSignUp && (
        <Field
          label={t("auth.displayName")}
          htmlFor="displayName"
          error={fields.displayName && t(fields.displayName, { count: 2 })}
        >
          <Input
            id="displayName"
            name="displayName"
            autoComplete="nickname"
            placeholder={t("auth.displayNamePlaceholder")}
            defaultValue={values.displayName}
            required
          />
        </Field>
      )}

      <Field
        label={t("auth.email")}
        htmlFor="email"
        error={fields.email && t(fields.email, { count: 1 })}
      >
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          defaultValue={values.email}
          required
        />
      </Field>

      <Field
        label={t("auth.password")}
        htmlFor="password"
        hint={isSignUp ? t("auth.passwordHint") : undefined}
        error={fields.password && t(fields.password, { count: 8 })}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          required
        />
      </Field>

      {state.status === "error" && !state.fields && (
        <p role="alert" className="text-body-sm text-danger">
          {t(state.error)}
        </p>
      )}

      <Button type="submit" size="lg" loading={pending} className="mt-2">
        {isSignUp ? t("auth.submitSignUp") : t("auth.submitSignIn")}
      </Button>
    </form>
  );
}

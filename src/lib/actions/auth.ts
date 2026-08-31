"use server";

import { headers } from "next/headers";

import { localeRedirect } from "@/lib/utils/locale-redirect";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, signInSchema, signUpSchema } from "@/lib/validation/schemas";

import { fail, ok, toErrorKey, type ActionResult } from "./result";

/**
 * Destino de vuelta tras entrar o registrarse.
 *
 * Solo se aceptan rutas internas que empiecen por una sola barra. Sin ese
 * filtro, un enlace con `?next=https://otro-sitio` convertiría el login en un
 * redirector abierto hacia cualquier dominio.
 */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

export type AuthState =
  | { status: "idle" }
  | {
      status: "error";
      error: string;
      fields?: Record<string, string>;
      /**
       * Lo que el usuario había escrito (nunca la contraseña). React 19 resetea
       * el formulario tras cada intento; sin esto, un error obliga a reescribir todo.
       */
      values?: { displayName?: string; email?: string };
    }
  | { status: "check_email" };

/** Valores a conservar en el formulario tras un intento fallido. */
function keptValues(formData: FormData): { displayName?: string; email?: string } {
  const displayName = formData.get("displayName");
  const email = formData.get("email");
  return {
    displayName: typeof displayName === "string" ? displayName : undefined,
    email: typeof email === "string" ? email : undefined,
  };
}

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      error: "errors.generic",
      fields: fieldErrors(parsed.error),
      values: keptValues(formData),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { status: "error", error: toErrorKey(error), values: keptValues(formData) };
  }

  return localeRedirect(safeNext(formData.get("next")));
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      error: "errors.generic",
      fields: fieldErrors(parsed.error),
      values: keptValues(formData),
    };
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // El trigger `handle_new_user` toma este dato para crear el perfil.
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { status: "error", error: toErrorKey(error), values: keptValues(formData) };
  }

  // Con confirmación de correo activada no hay sesión todavía: hay que avisar
  // al usuario que revise su bandeja en vez de dejarlo mirando un formulario.
  if (!data.session) return { status: "check_email" };

  return localeRedirect(safeNext(formData.get("next")));
}

export async function signOutAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) return fail(toErrorKey(error));
  return localeRedirect("/");
}

export async function updateDisplayNameAction(
  displayName: string,
): Promise<ActionResult> {
  const trimmed = displayName.trim();
  if (trimmed.length < 2 || trimmed.length > 40) return fail("validation.min");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("errors.AUTH_REQUIRED");

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: trimmed })
    .eq("id", user.id);

  if (error) return fail(toErrorKey(error));
  return ok();
}

/**
 * Pide el enlace para restablecer la contraseña.
 *
 * Responde siempre lo mismo, exista o no la cuenta. Decir "ese correo no está
 * registrado" convertiría el formulario en una forma de averiguar quién tiene
 * cuenta en la plataforma.
 */
export async function requestPasswordResetAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@")) {
    return { status: "error", error: "validation.email" };
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  return { status: "check_email" };
}

/** Guarda la contraseña nueva. Requiere la sesión que abre el enlace del correo. */
export async function updatePasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { status: "error", error: "validation.min", fields: { password: "validation.min" } };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sin sesión el enlace venció o ya se usó: no hay a quién cambiarle la clave.
  if (!user) return { status: "error", error: "auth.resetExpired" };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { status: "error", error: toErrorKey(error) };

  return localeRedirect("/app");
}

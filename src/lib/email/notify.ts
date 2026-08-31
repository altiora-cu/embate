import "server-only";

import { Resend } from "resend";

import { createClient } from "@/lib/supabase/server";
import { getUserEmails, isAdminClientConfigured } from "@/lib/supabase/admin";
import type { Locale } from "@/i18n/routing";

import { matchupsReadyEmail, pendingConfirmationEmail } from "./templates";

/**
 * Envío de avisos transaccionales (§13).
 *
 * Regla de diseño: **un fallo de correo nunca rompe la acción del usuario**. Si
 * Resend está caído o sin configurar, el resultado igual se guarda y el torneo
 * sigue; solo se pierde el aviso. Por eso todo va envuelto en try/catch y las
 * funciones no devuelven error al llamador.
 */

function resendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

function fromAddress(): string {
  return process.env.EMBATE_EMAIL_FROM ?? "Embate <onboarding@resend.dev>";
}

/** `true` si el servidor puede mandar correos. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY) && isAdminClientConfigured();
}

/** Idioma preferido de cada usuario, para no mandarle el aviso en el idioma equivocado. */
async function localesOf(userIds: readonly string[]): Promise<Map<string, Locale>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, locale, display_name")
    .in("id", [...userIds]);

  return new Map(
    (data ?? []).map((row) => [row.id, (row.locale === "en" ? "en" : "es") as Locale]),
  );
}

async function send(
  messages: { to: string; subject: string; html: string; text: string }[],
): Promise<void> {
  const resend = resendClient();
  if (!resend || messages.length === 0) return;

  await Promise.allSettled(
    messages.map((message) =>
      resend.emails.send({
        from: fromAddress(),
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    ),
  );
}

/**
 * Avisa al rival que tiene un resultado esperando su confirmación.
 * Es el aviso más importante del producto: sin él, un partido puede quedar
 * frenado días porque el otro jugador no volvió a entrar a la app.
 */
export async function notifyPendingConfirmation({
  rivalUserId,
  reporterName,
  tournamentName,
  homeScore,
  awayScore,
  matchUrl,
}: {
  rivalUserId: string;
  reporterName: string;
  tournamentName: string;
  homeScore: number;
  awayScore: number;
  matchUrl: string;
}): Promise<void> {
  if (!isEmailConfigured()) return;

  try {
    const [emails, locales] = await Promise.all([
      getUserEmails([rivalUserId]),
      localesOf([rivalUserId]),
    ]);

    const to = emails.get(rivalUserId);
    if (!to) return;

    const content = pendingConfirmationEmail({
      locale: locales.get(rivalUserId) ?? "es",
      reporterName,
      tournamentName,
      homeScore,
      awayScore,
      url: matchUrl,
    });

    await send([{ to, ...content }]);
  } catch {
    // El aviso es accesorio: si falla, el resultado ya quedó registrado igual.
  }
}

/** Avisa a todos los inscritos que ya hay cruces generados. */
export async function notifyMatchupsReady({
  userIds,
  tournamentName,
  tournamentUrl,
}: {
  userIds: readonly string[];
  tournamentName: string;
  tournamentUrl: string;
}): Promise<void> {
  if (!isEmailConfigured() || userIds.length === 0) return;

  try {
    const [emails, locales] = await Promise.all([
      getUserEmails(userIds),
      localesOf(userIds),
    ]);

    const messages = [...emails.entries()].map(([userId, to]) => ({
      to,
      ...matchupsReadyEmail({
        locale: locales.get(userId) ?? "es",
        tournamentName,
        url: tournamentUrl,
      }),
    }));

    await send(messages);
  } catch {
    // Ídem: el torneo ya arrancó aunque el correo no salga.
  }
}

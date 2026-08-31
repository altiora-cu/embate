import type { Locale } from "@/i18n/routing";

/**
 * Plantillas de los avisos transaccionales (§13).
 *
 * Bilingües como el resto del producto. HTML deliberadamente simple y con
 * estilos en línea: los clientes de correo ignoran hojas de estilo, y un correo
 * que llega roto es peor que uno sobrio. Siempre se manda también texto plano.
 */

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const BASE = "#0B0D12";
const ACCENT = "#C6FF3D";
const INK = "#F5F3EE";
const MUTED = "#8A93A6";

function layout({
  title,
  body,
  ctaLabel,
  ctaUrl,
  disclaimer,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  disclaimer: string;
}): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BASE};font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BASE};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#1A1D24;border-radius:16px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 24px;font-size:14px;letter-spacing:2px;color:${ACCENT};font-weight:bold;">EMBATE</p>
                <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${INK};">${title}</h1>
                <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:${MUTED};">${body}</p>
                <a href="${ctaUrl}" style="display:inline-block;background:${ACCENT};color:${BASE};text-decoration:none;font-weight:bold;font-size:15px;padding:12px 24px;border-radius:8px;">${ctaLabel}</a>
                <p style="margin:32px 0 0;font-size:11px;line-height:1.5;color:${MUTED};">${disclaimer}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const DISCLAIMER: Record<Locale, string> = {
  es: "Embate no está afiliado, patrocinado ni respaldado por Electronic Arts Inc. ni sus licenciantes.",
  en: "Embate is not affiliated with, sponsored by, or endorsed by Electronic Arts Inc. or its licensors.",
};

/** Aviso al rival: alguien cargó un resultado y falta su confirmación. */
export function pendingConfirmationEmail({
  locale,
  reporterName,
  tournamentName,
  homeScore,
  awayScore,
  url,
}: {
  locale: Locale;
  reporterName: string;
  tournamentName: string;
  homeScore: number;
  awayScore: number;
  url: string;
}): EmailContent {
  const score = `${homeScore} - ${awayScore}`;

  if (locale === "en") {
    const title = "You have a result to confirm";
    const body = `${reporterName} reported ${score} in ${tournamentName}. The result won't count until you confirm it — or open a dispute if it doesn't match your screenshot.`;
    return {
      subject: `Confirm the result — ${tournamentName}`,
      html: layout({
        title,
        body,
        ctaLabel: "Review the match",
        ctaUrl: url,
        disclaimer: DISCLAIMER.en,
      }),
      text: `${title}\n\n${body}\n\n${url}`,
    };
  }

  const title = "Tenés un resultado por confirmar";
  const body = `${reporterName} cargó ${score} en ${tournamentName}. El resultado no cuenta hasta que lo confirmes — o abras una disputa si no coincide con tu captura.`;
  return {
    subject: `Confirmá el resultado — ${tournamentName}`,
    html: layout({
      title,
      body,
      ctaLabel: "Ver el partido",
      ctaUrl: url,
      disclaimer: DISCLAIMER.es,
    }),
    text: `${title}\n\n${body}\n\n${url}`,
  };
}

/** Aviso a los inscritos: se cerraron inscripciones y ya hay cruce. */
export function matchupsReadyEmail({
  locale,
  tournamentName,
  url,
}: {
  locale: Locale;
  tournamentName: string;
  url: string;
}): EmailContent {
  if (locale === "en") {
    const title = "Your matchup is ready";
    const body = `Registration for ${tournamentName} is closed and the draw is done. Check who you're facing and get the match played.`;
    return {
      subject: `Your matchup — ${tournamentName}`,
      html: layout({
        title,
        body,
        ctaLabel: "See the bracket",
        ctaUrl: url,
        disclaimer: DISCLAIMER.en,
      }),
      text: `${title}\n\n${body}\n\n${url}`,
    };
  }

  const title = "Ya tenés cruce";
  const body = `Se cerraron las inscripciones de ${tournamentName} y el sorteo está hecho. Mirá contra quién te toca y arreglá el partido.`;
  return {
    subject: `Tu cruce — ${tournamentName}`,
    html: layout({
      title,
      body,
      ctaLabel: "Ver el cuadro",
      ctaUrl: url,
      disclaimer: DISCLAIMER.es,
    }),
    text: `${title}\n\n${body}\n\n${url}`,
  };
}

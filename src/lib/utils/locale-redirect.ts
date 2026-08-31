import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";

/**
 * Redirección que conserva el prefijo de idioma del usuario.
 *
 * `redirect` de next/navigation ignora el locale: un usuario navegando en /en
 * terminaría en la versión en español. Este wrapper resuelve el idioma activo
 * y devuelve `never` para que TypeScript sepa que la ejecución no continúa.
 */
export async function localeRedirect(href: string): Promise<never> {
  redirect({ href, locale: await getLocale() });
  // redirect() lanza NEXT_REDIRECT; esta línea solo satisface el tipado.
  throw new Error("unreachable");
}

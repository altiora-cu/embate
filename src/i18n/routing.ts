import { defineRouting } from "next-intl/routing";

/**
 * Bilingüe ES/EN desde el día uno (§1 del paquete de dirección).
 * El español es el idioma por defecto: el mercado inicial es hispanohablante.
 */
export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

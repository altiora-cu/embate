import { getTranslations } from "next-intl/server";

import { Isotipo } from "@/components/ui/logo";

/**
 * Pantalla de configuración pendiente.
 *
 * Sin credenciales de Supabase la app no puede hacer nada útil, pero fallar con
 * un 500 genérico deja a quien despliega adivinando. Mejor decir exactamente qué
 * falta y dónde ponerlo.
 */
export async function SetupRequired() {
  const t = await getTranslations("errors");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-5 text-center">
      <Isotipo className="size-12 text-warn" />
      <h1 className="text-section">{t("supabaseMissing")}</h1>
      <p className="max-w-md text-body-sm leading-relaxed text-muted">
        {t("supabaseMissingBody")}
      </p>
      <code className="rounded-[var(--radius-control)] border border-surface-alt bg-surface px-4 py-2.5 text-left text-meta text-muted">
        cp .env.example .env.local
      </code>
    </div>
  );
}

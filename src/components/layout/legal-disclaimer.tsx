import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils/cn";

/**
 * Disclaimer de no afiliación con Electronic Arts (§2 y §9 del paquete).
 *
 * Es OBLIGATORIO y debe estar visible en toda superficie pública de la app:
 * footer público y cualquier página de torneo compartible. No es decoración
 * legal: es la condición para poder nombrar el juego sin usar la marca de EA.
 */
export function LegalDisclaimer({ className }: { className?: string }) {
  const t = useTranslations("brand");
  return (
    <p className={cn("text-meta leading-relaxed text-muted", className)}>
      {t("disclaimer")}
    </p>
  );
}

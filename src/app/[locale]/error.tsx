"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Isotipo } from "@/components/ui/logo";

/**
 * Pantalla de error de la aplicación.
 *
 * Sin esto, cualquier fallo no controlado deja al usuario frente a la pantalla
 * cruda de Next.js — en producción, un texto genérico sin marca ni salida. Acá
 * al menos entiende qué pasó y tiene dos caminos para seguir.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();

  useEffect(() => {
    // El `digest` es lo que permite cruzar este error con el registro del
    // servidor. Cuando haya monitoreo, este es el lugar donde reportarlo.
    console.error("[embate]", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-5 text-center">
      <Isotipo className="size-12 text-danger" />
      <h1 className="text-section">{t("errors.unexpected")}</h1>
      <p className="max-w-sm text-body-sm text-muted">{t("errors.unexpectedBody")}</p>

      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>{t("errors.retry")}</Button>
        <Button variant="secondary" onClick={() => (window.location.href = "/")}>
          {t("nav.home")}
        </Button>
      </div>

      {error.digest && (
        <p className="mt-2 text-meta text-muted">
          <code>{error.digest}</code>
        </p>
      )}
    </div>
  );
}

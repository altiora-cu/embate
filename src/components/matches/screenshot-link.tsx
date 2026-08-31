import { getTranslations } from "next-intl/server";

import { getScreenshotUrl } from "@/lib/actions/matches";

/**
 * Enlace a la captura de un reporte.
 *
 * El bucket es privado: se genera una URL firmada de 10 minutos en el servidor
 * en vez de exponer el archivo públicamente. Una captura puede ser prueba en
 * una disputa, y no debería quedar accesible para cualquiera con el enlace.
 */
export async function ScreenshotLink({ path }: { path: string | null }) {
  if (!path) return null;

  const t = await getTranslations("match");
  const url = await getScreenshotUrl(path);
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-meta font-medium text-signal underline-offset-4 hover:underline"
    >
      {t("viewScreenshot")}
      <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true" fill="none">
        <path
          d="M7 17L17 7M17 7H9M17 7v8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}

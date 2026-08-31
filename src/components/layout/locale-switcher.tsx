"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils/cn";

/**
 * Cambio de idioma sin perder la página en la que está el usuario.
 * Bilingüe ES/EN desde el día uno (§1).
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  function change(next: Locale) {
    if (next === locale) return;
    startTransition(() => {
      // `params` conserva los segmentos dinámicos (slug de comunidad, id de torneo).
      router.replace(
        // @ts-expect-error -- next-intl no puede tipar rutas dinámicas arbitrarias
        { pathname, params },
        { locale: next },
      );
    });
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-[var(--radius-pill)] border border-surface-alt p-0.5",
        isPending && "opacity-60",
        className,
      )}
      role="group"
      aria-label={t("language")}
    >
      {routing.locales.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => change(value)}
          aria-current={value === locale ? "true" : undefined}
          className={cn(
            "rounded-[var(--radius-pill)] px-2.5 py-1 text-meta font-medium uppercase",
            "transition-colors duration-150 ease-(--ease-standard)",
            value === locale
              ? "bg-brand text-brand-ink"
              : "text-muted hover:text-ink",
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Navegación de la comunidad. Scroll horizontal en móvil en vez de un menú
 * hamburguesa: son cuatro destinos y el panel de admin tiene que estar a un
 * toque también desde el celular (§12).
 */
export function CommunityNav({ slug, isAdmin }: { slug: string; isAdmin: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const base = `/c/${slug}`;

  const items = [
    { href: base, label: t("tournaments"), exact: true },
    { href: `${base}/ranking`, label: t("ranking"), exact: false },
    { href: `${base}/me`, label: t("profile"), exact: false },
    ...(isAdmin ? [{ href: `${base}/admin`, label: t("admin"), exact: false }] : []),
  ];

  return (
    <nav
      aria-label={t("tournaments")}
      className="border-b border-surface-alt/60 bg-base/60"
    >
      <ul className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-3 sm:px-7">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-11 items-center px-3 text-body-sm whitespace-nowrap",
                  "transition-colors duration-150 ease-(--ease-standard)",
                  active ? "font-medium text-ink" : "text-muted hover:text-ink",
                )}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

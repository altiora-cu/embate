import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Isotipo } from "@/components/ui/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { isPlatformAdmin } from "@/lib/data/admin";

/**
 * Cabecera de las pantallas privadas.
 *
 * Cuando el usuario está dentro de una comunidad, el nombre de esa comunidad
 * ocupa el lugar de la marca: el organizador es el protagonista, Embate queda
 * como el isotipo a la izquierda (marca blanca, §4 ítem 12).
 */
export async function AppHeader({
  community,
}: {
  community?: { name: string; slug: string; logoUrl: string | null };
}) {
  const t = await getTranslations("nav");
  const showAdmin = await isPlatformAdmin();

  return (
    <header className="sticky top-0 z-40 border-b border-surface-alt/60 bg-base/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/app"
            aria-label={t("myCommunities")}
            className="shrink-0 transition-opacity hover:opacity-80"
          >
            <Isotipo className="size-6 text-brand" />
          </Link>

          {community ? (
            <Link
              href={`/c/${community.slug}`}
              className="flex min-w-0 items-center gap-2.5"
            >
              {community.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- logo del organizador, dominio arbitrario
                <img
                  src={community.logoUrl}
                  alt=""
                  className="size-6 shrink-0 rounded-[var(--radius-control)] object-cover"
                />
              )}
              <span className="truncate font-display text-body font-bold tracking-tight">
                {community.name}
              </span>
            </Link>
          ) : (
            <span className="font-display text-body font-bold tracking-[0.04em]">
              EMBATE
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {showAdmin && (
            <Link
              href="/app/admin"
              className="rounded-[var(--radius-control)] border border-brand/40 px-2.5 py-1 text-meta font-medium text-brand transition-colors hover:bg-brand/10"
            >
              {t("platformAdmin")}
            </Link>
          )}
          <LocaleSwitcher className="hidden sm:inline-flex" />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Isotipo } from "@/components/ui/logo";

import { LegalDisclaimer } from "./legal-disclaimer";

export function SiteFooter() {
  const t = useTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-surface-alt/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-muted">
            <Isotipo className="size-5 text-brand" />
            <span className="font-display text-body-sm font-bold tracking-[0.04em]">
              EMBATE
            </span>
          </span>

          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-body-sm">
            <Link
              href="/legal/terms"
              className="text-muted transition-colors hover:text-ink"
            >
              {t("legal.terms")}
            </Link>
            <Link
              href="/legal/privacy"
              className="text-muted transition-colors hover:text-ink"
            >
              {t("legal.privacy")}
            </Link>
          </nav>
        </div>

        {/* Obligatorio en toda superficie pública (§9). */}
        <LegalDisclaimer className="max-w-2xl" />

        <p className="text-meta text-muted">
          © {year} Embate. {t("landing.footerRights")}
        </p>
      </div>
    </footer>
  );
}

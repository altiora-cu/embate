import { getFormatter, getTranslations } from "next-intl/server";

import { LegalDisclaimer } from "@/components/layout/legal-disclaimer";
import { SiteFooter } from "@/components/layout/site-footer";
import { Logo } from "@/components/ui/logo";
import { Link } from "@/i18n/navigation";
import {
  LEGAL_DOCUMENTS,
  LEGAL_LAST_UPDATED,
  type LegalDocumentId,
} from "@/content/legal";
import type { Locale } from "@/i18n/routing";

/** Render compartido de las páginas legales: mismo formato para ambas. */
export async function LegalPage({
  document,
  locale,
}: {
  document: LegalDocumentId;
  locale: Locale;
}) {
  const t = await getTranslations("legal");
  const format = await getFormatter();
  const content = LEGAL_DOCUMENTS[document][locale];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-surface-alt/40">
        <div className="mx-auto w-full max-w-3xl px-5 py-4 sm:px-8">
          <Link href="/" aria-label="Embate">
            <Logo />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:px-8">
        <h1 className="text-hero leading-tight">{content.title}</h1>
        <p className="mt-2 text-meta text-muted">
          {t("lastUpdated", {
            date: format.dateTime(new Date(LEGAL_LAST_UPDATED), { dateStyle: "long" }),
          })}
        </p>

        <p className="mt-7 max-w-prose text-body leading-relaxed text-muted">
          {content.intro}
        </p>

        <div className="mt-10 flex flex-col gap-9">
          {content.sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-3">
              <h2 className="text-subtitle">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="max-w-prose text-body-sm leading-relaxed text-muted"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="mt-12 border-t border-surface-alt/60 pt-6">
          <h2 className="text-body-sm font-medium">{t("disclaimerTitle")}</h2>
          <LegalDisclaimer className="mt-2 max-w-prose" />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

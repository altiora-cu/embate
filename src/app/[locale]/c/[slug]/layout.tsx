import type { CSSProperties } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { CommunityNav } from "@/components/communities/community-nav";
import { LegalDisclaimer } from "@/components/layout/legal-disclaimer";
import { SetupRequired } from "@/components/layout/setup-required";
import { requireCommunity } from "@/lib/data/community";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { contrastInk, safeAccent } from "@/lib/utils/color";

/**
 * Marco de una comunidad.
 *
 * Acá se aplica la marca blanca: el acento del organizador se inyecta en las
 * variables CSS que todo el sistema de diseño ya consume (`--brand-accent`), así
 * que ningún componente necesita saber en qué comunidad está. El color del texto
 * sobre el acento se calcula, no se asume: un acento claro y uno oscuro necesitan
 * tintas opuestas para seguir siendo legibles.
 */
export default async function CommunityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupRequired />;

  const { slug } = await params;
  const { community, isAdmin } = await requireCommunity(slug);

  const accent = safeAccent(community.brand_accent);
  const brandStyle = {
    "--brand-accent": accent,
    "--brand-accent-ink": contrastInk(accent),
  } as CSSProperties;

  return (
    <div className="flex min-h-dvh flex-col" style={brandStyle}>
      <AppHeader
        community={{
          name: community.name,
          slug: community.slug,
          logoUrl: community.logo_url,
        }}
      />
      <CommunityNav slug={community.slug} isAdmin={isAdmin} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-8 sm:py-10">
        {children}
      </main>

      <footer className="border-t border-surface-alt/60 px-4 py-6 sm:px-8">
        {/* Obligatorio también acá: las páginas de torneo son compartibles (§9). */}
        <LegalDisclaimer className="mx-auto max-w-6xl" />
      </footer>
    </div>
  );
}

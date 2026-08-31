import { AppHeader } from "@/components/layout/app-header";
import { LegalDisclaimer } from "@/components/layout/legal-disclaimer";
import { SetupRequired } from "@/components/layout/setup-required";
import { requireUser } from "@/lib/data/community";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Zona privada: sin sesión, redirige a login antes de renderizar nada. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <SetupRequired />;

  await requireUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-12">
        {children}
      </main>
      <footer className="border-t border-surface-alt/60 px-4 py-6 sm:px-8">
        <LegalDisclaimer className="mx-auto max-w-6xl" />
      </footer>
    </div>
  );
}

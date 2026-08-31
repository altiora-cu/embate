import { Isotipo } from "@/components/ui/logo";
import { LegalDisclaimer } from "@/components/layout/legal-disclaimer";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { SetupRequired } from "@/components/layout/setup-required";
import { Link } from "@/i18n/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Marco de las pantallas de acceso.
 * Un solo punto focal: el formulario. Nada más compite por la atención.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Sin Supabase el formulario existiría pero no podría autenticar a nadie:
  // mejor decirlo de frente que dejar que falle al enviar.
  if (!isSupabaseConfigured()) return <SetupRequired />;

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" />
      <div className="pointer-events-none absolute top-0 left-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/10 blur-[110px]" />

      <header className="relative flex items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" aria-label="Embate" className="inline-flex items-center gap-2.5">
          <Isotipo className="size-7 text-brand" />
          <span className="font-display text-subtitle font-bold tracking-[0.04em]">
            EMBATE
          </span>
        </Link>
        <LocaleSwitcher />
      </header>

      <main className="relative flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="relative px-5 pb-8 sm:px-8">
        <LegalDisclaimer className="mx-auto max-w-sm text-center" />
      </footer>
    </div>
  );
}

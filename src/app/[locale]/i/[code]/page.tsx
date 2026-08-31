import { localeRedirect } from "@/lib/utils/locale-redirect";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/layout/setup-required";

/**
 * Enlace de invitación: `/i/ABCD2345` o `/i/ABCD2345?t=<torneo>`.
 *
 * Es el único enlace que el organizador necesita repartir. Resuelve en un paso
 * lo que antes eran cuatro (entrá, buscá el código, buscá la comunidad, buscá el
 * torneo): une a quien lo abre y lo deja parado en la pantalla donde tiene que
 * actuar — la inscripción al torneo, si el enlace apunta a uno.
 *
 * Sin sesión manda a crear cuenta y vuelve acá, para no perder la invitación en
 * el camino.
 */
export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupRequired />;

  const { code } = await params;
  const { t: tournamentId } = await searchParams;

  const user = await getCurrentUser();

  if (!user) {
    // Se conserva el destino para retomar la invitación después de registrarse.
    const back = `/i/${code}${tournamentId ? `?t=${tournamentId}` : ""}`;
    return localeRedirect(`/signup?next=${encodeURIComponent(back)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_community_by_code", {
    p_code: code,
  });

  const joined = data?.[0];

  // Un código inválido no debe dejar al invitado en una pantalla de error críptica:
  // se lo manda a la pantalla de unirse, con el código puesto para que lo revise.
  if (error || !joined) {
    return localeRedirect(`/app/join?code=${encodeURIComponent(code)}`);
  }

  return localeRedirect(
    tournamentId
      ? `/c/${joined.slug}/t/${tournamentId}`
      : `/c/${joined.slug}`,
  );
}

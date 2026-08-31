import { createClient } from "@/lib/supabase/server";

export interface OpenDispute {
  id: string;
  reason: string;
  createdAt: string;
  openedByName: string;
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  homeName: string;
  awayName: string;
  /** Último marcador reportado, como sugerencia al resolver. */
  suggestedHome: number;
  suggestedAway: number;
  reports: {
    id: string;
    reporterName: string;
    homeScore: number;
    awayScore: number;
    screenshotPath: string | null;
  }[];
}

/**
 * Disputas abiertas de una comunidad, con todo lo necesario para resolverlas
 * en una sola pantalla: quién la abrió, el motivo, y las dos capturas enfrentadas.
 *
 * RLS ya acota la lectura a la comunidad del admin; el filtro explícito por
 * torneo evita además traer disputas de otras comunidades donde también sea admin.
 */
export async function getOpenDisputes(communityId: string): Promise<OpenDispute[]> {
  const supabase = await createClient();

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name")
    .eq("community_id", communityId);

  const tournamentIds = (tournaments ?? []).map((row) => row.id);
  if (tournamentIds.length === 0) return [];

  const tournamentNameById = new Map(
    (tournaments ?? []).map((row) => [row.id, row.name]),
  );

  const { data: matches } = await supabase
    .from("matches")
    .select("id, tournament_id, home_entry_id, away_entry_id")
    .in("tournament_id", tournamentIds)
    .eq("status", "disputed");

  const matchIds = (matches ?? []).map((row) => row.id);
  if (matchIds.length === 0) return [];

  const entryIds = (matches ?? [])
    .flatMap((row) => [row.home_entry_id, row.away_entry_id])
    .filter((id): id is string => Boolean(id));

  const [{ data: disputes }, { data: entries }, { data: reports }] = await Promise.all([
    supabase
      .from("disputes")
      .select("*, profiles!disputes_opened_by_fkey(display_name)")
      .in("match_id", matchIds)
      .eq("status", "open")
      .order("created_at", { ascending: true }),
    supabase.from("tournament_entries").select("id, gamertag").in("id", entryIds),
    supabase
      .from("match_reports")
      .select("*, profiles(display_name)")
      .in("match_id", matchIds)
      .order("created_at", { ascending: false }),
  ]);

  const gamertagById = new Map((entries ?? []).map((row) => [row.id, row.gamertag]));
  const matchById = new Map((matches ?? []).map((row) => [row.id, row]));

  return (disputes ?? []).map((dispute) => {
    const match = matchById.get(dispute.match_id)!;
    const matchReports = (reports ?? []).filter(
      (report) => report.match_id === dispute.match_id,
    );
    const latest = matchReports[0];

    return {
      id: dispute.id,
      reason: dispute.reason,
      createdAt: dispute.created_at,
      openedByName:
        (dispute.profiles as unknown as { display_name: string } | null)?.display_name ??
        "",
      matchId: dispute.match_id,
      tournamentId: match.tournament_id,
      tournamentName: tournamentNameById.get(match.tournament_id) ?? "",
      homeName: match.home_entry_id
        ? (gamertagById.get(match.home_entry_id) ?? "")
        : "",
      awayName: match.away_entry_id
        ? (gamertagById.get(match.away_entry_id) ?? "")
        : "",
      suggestedHome: latest?.home_score ?? 0,
      suggestedAway: latest?.away_score ?? 0,
      reports: matchReports.map((report) => ({
        id: report.id,
        reporterName:
          (report.profiles as unknown as { display_name: string } | null)
            ?.display_name ?? "",
        homeScore: report.home_score,
        awayScore: report.away_score,
        screenshotPath: report.screenshot_path,
      })),
    };
  });
}

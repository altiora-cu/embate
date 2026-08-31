import { createClient } from "@/lib/supabase/server";
import type { PlayerStatsRow } from "@/lib/supabase/database.types";
import { calculateRating } from "@/lib/domain/rating";
import { buildCommunityRanking } from "@/lib/domain/standings";
import type { RatingBreakdown } from "@/lib/domain/types";

/** Contadores vacíos: un jugador sin partidos todavía no tiene fila en player_stats. */
const EMPTY_STATS = {
  wins: 0,
  draws: 0,
  losses: 0,
  goals_for: 0,
  goals_against: 0,
  matches_on_time: 0,
  no_shows: 0,
  disputes_total: 0,
  disputes_lost: 0,
};

export interface PlayerProfile {
  userId: string;
  displayName: string;
  stats: typeof EMPTY_STATS;
  rating: RatingBreakdown;
  played: number;
  winRate: number;
  /** Puesto en el ranking de ESTA comunidad. `null` si aún no jugó. */
  rank: number | null;
}

/** Traduce los contadores guardados a la calificación de 5 estrellas (§4.1). */
function ratingFrom(stats: typeof EMPTY_STATS): RatingBreakdown {
  return calculateRating({
    wins: stats.wins,
    draws: stats.draws,
    losses: stats.losses,
    matchesOnTime: stats.matches_on_time,
    noShows: stats.no_shows,
    disputesLost: stats.disputes_lost,
    disputesTotal: stats.disputes_total,
  });
}

/**
 * Perfil de un jugador DENTRO de una comunidad.
 *
 * Las estadísticas y el puesto son siempre por comunidad (§4, ítem 11): no
 * existe un perfil global comparable entre comunidades distintas.
 */
export async function getPlayerProfile(
  communityId: string,
  userId: string,
): Promise<PlayerProfile> {
  const supabase = await createClient();

  const [{ data: profile }, { data: statsRow }, { data: allStats }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase
      .from("player_stats")
      .select("*")
      .eq("community_id", communityId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("player_stats")
      .select("user_id, wins, draws, losses")
      .eq("community_id", communityId),
  ]);

  const stats = statsRow
    ? {
        wins: statsRow.wins,
        draws: statsRow.draws,
        losses: statsRow.losses,
        goals_for: statsRow.goals_for,
        goals_against: statsRow.goals_against,
        matches_on_time: statsRow.matches_on_time,
        no_shows: statsRow.no_shows,
        disputes_total: statsRow.disputes_total,
        disputes_lost: statsRow.disputes_lost,
      }
    : EMPTY_STATS;

  const played = stats.wins + stats.draws + stats.losses;

  const ranking = buildCommunityRanking(
    (allStats ?? []).map((row) => ({
      userId: row.user_id,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
    })),
  );

  return {
    userId,
    displayName: profile?.display_name ?? "",
    stats,
    rating: ratingFrom(stats),
    played,
    winRate: played === 0 ? 0 : stats.wins / played,
    rank: played === 0 ? null : (ranking.find((r) => r.userId === userId)?.rank ?? null),
  };
}

/** Ranking "más ganador" de la comunidad. Nunca global entre comunidades. */
export async function getCommunityRanking(communityId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("player_stats")
    .select("*, profiles(display_name)")
    .eq("community_id", communityId);

  if (error) throw error;

  const rows = (data ?? []) as (PlayerStatsRow & {
    profiles: { display_name: string } | null;
  })[];

  const nameOf = new Map(rows.map((row) => [row.user_id, row.profiles?.display_name ?? ""]));
  const ratingOf = new Map(
    rows.map((row) => [
      row.user_id,
      ratingFrom({
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        goals_for: row.goals_for,
        goals_against: row.goals_against,
        matches_on_time: row.matches_on_time,
        no_shows: row.no_shows,
        disputes_total: row.disputes_total,
        disputes_lost: row.disputes_lost,
      }),
    ]),
  );

  return buildCommunityRanking(
    rows.map((row) => ({
      userId: row.user_id,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
    })),
  )
    // Solo aparecen quienes ya jugaron: una lista de ceros no es un ranking.
    .filter((row) => row.played > 0)
    .map((row) => ({
      ...row,
      displayName: nameOf.get(row.userId) ?? "",
      rating: ratingOf.get(row.userId)!,
    }));
}

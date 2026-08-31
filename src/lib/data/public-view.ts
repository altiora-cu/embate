import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { buildStandings } from "@/lib/domain/standings";
import type { Match, TournamentEntry } from "@/lib/domain/types";
import type { CommunityRow, TournamentRow } from "@/lib/supabase/database.types";

/**
 * Lectura de la página pública de una comunidad.
 *
 * Lo que se expone: nombre de la comunidad, torneos, gamertags y resultados.
 * Lo que NO: perfiles, correos, capturas, disputas y estadísticas de jugador.
 * Ese recorte no depende de estas consultas — las políticas RLS del rol anónimo
 * simplemente no dan acceso a esas tablas. Acá solo se pide lo que se muestra.
 */

export interface PublicTournament {
  tournament: TournamentRow;
  entries: TournamentEntry[];
  matches: Match[];
}

/** Comunidad pública por slug. 404 si no existe o si no publicó su página. */
export async function getPublicCommunity(slug: string): Promise<CommunityRow> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("communities")
    .select("*")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  // 404 y no 403: si la comunidad existe pero es privada, no hay por qué
  // confirmarle a un desconocido que existe.
  if (!data) notFound();
  return data;
}

/** Torneos publicados de la comunidad, del más nuevo al más viejo. */
export async function getPublicTournaments(
  communityId: string,
): Promise<TournamentRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("tournaments")
    .select("*")
    .eq("community_id", communityId)
    // Un torneo en inscripciones todavía no tiene nada que mirar.
    .in("status", ["in_progress", "finished"])
    .order("created_at", { ascending: false });

  return data ?? [];
}

/** Detalle público de un torneo: inscritos y cruces, sin datos personales. */
export async function getPublicTournament(
  tournamentId: string,
  communityId: string,
): Promise<PublicTournament> {
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .eq("community_id", communityId)
    .maybeSingle();

  if (!tournament) notFound();

  const [{ data: entryRows }, { data: matchRows }] = await Promise.all([
    supabase
      .from("tournament_entries")
      .select("id, tournament_id, user_id, gamertag, platform, seed")
      .eq("tournament_id", tournamentId)
      .order("seed", { ascending: true }),
    supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("round", { ascending: true })
      .order("position", { ascending: true }),
  ]);

  return {
    tournament,
    entries: (entryRows ?? []).map((row) => ({
      id: row.id,
      tournamentId: row.tournament_id,
      userId: row.user_id,
      gamertag: row.gamertag,
      platform: row.platform,
      seed: row.seed,
    })),
    matches: (matchRows ?? []).map((row) => ({
      id: row.id,
      tournamentId: row.tournament_id,
      round: row.round,
      position: row.position,
      homeEntryId: row.home_entry_id,
      awayEntryId: row.away_entry_id,
      homeScore: row.home_score,
      awayScore: row.away_score,
      status: row.status,
      winnerEntryId: row.winner_entry_id,
      nextMatchId: row.next_match_id,
      nextSlot: row.next_slot,
    })),
  };
}

/** Tabla de posiciones de un torneo público. */
export function publicStandings(detail: PublicTournament) {
  const byId = new Map(detail.entries.map((entry) => [entry.id, entry]));
  return buildStandings(detail.entries, detail.matches).map((row) => ({
    ...row,
    entry: { ...byId.get(row.entryId)!, displayName: byId.get(row.entryId)!.gamertag },
  }));
}

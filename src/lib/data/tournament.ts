import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type {
  EntryRow,
  MatchRow,
  TournamentRow,
} from "@/lib/supabase/database.types";
import type { Match, TournamentEntry } from "@/lib/domain/types";
import { buildStandings } from "@/lib/domain/standings";

/** Inscripción enriquecida con el nombre visible del jugador. */
export interface EntryWithPlayer extends TournamentEntry {
  displayName: string;
}

export interface TournamentDetail {
  tournament: TournamentRow;
  entries: EntryWithPlayer[];
  matches: Match[];
  /** Inscripción del usuario actual en este torneo, si está anotado. */
  myEntry: EntryWithPlayer | null;
}

const toEntry = (row: EntryRow, displayName: string): EntryWithPlayer => ({
  id: row.id,
  tournamentId: row.tournament_id,
  userId: row.user_id,
  gamertag: row.gamertag,
  platform: row.platform,
  seed: row.seed,
  displayName,
});

const toMatch = (row: MatchRow): Match => ({
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
});

export async function listTournaments(communityId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("*, tournament_entries(count)")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const { tournament_entries, ...tournament } = row as TournamentRow & {
      tournament_entries: { count: number }[];
    };
    return {
      tournament: tournament as TournamentRow,
      entryCount: tournament_entries?.[0]?.count ?? 0,
    };
  });
}

/** Torneo completo: inscritos, cruces y la inscripción propia. */
export async function getTournamentDetail(
  tournamentId: string,
  communityId: string,
  userId: string,
): Promise<TournamentDetail> {
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .maybeSingle();

  // Comprobación explícita del tenant: aunque RLS ya lo impide, una URL de otra
  // comunidad debe dar 404 y no una página vacía.
  if (!tournament || tournament.community_id !== communityId) notFound();

  const [{ data: entryRows }, { data: matchRows }] = await Promise.all([
    supabase
      .from("tournament_entries")
      .select("*, profiles(display_name)")
      .eq("tournament_id", tournamentId)
      .order("seed", { ascending: true }),
    supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("round", { ascending: true })
      .order("position", { ascending: true }),
  ]);

  const entries = (entryRows ?? []).map((row) => {
    const { profiles, ...entry } = row as EntryRow & {
      profiles: { display_name: string } | null;
    };
    return toEntry(entry as EntryRow, profiles?.display_name ?? entry.gamertag);
  });

  return {
    tournament,
    entries,
    matches: (matchRows ?? []).map(toMatch),
    myEntry: entries.find((entry) => entry.userId === userId) ?? null,
  };
}

/** Tabla de posiciones calculada a partir de los partidos ya resueltos. */
export function standingsFor(detail: TournamentDetail) {
  const byId = new Map(detail.entries.map((entry) => [entry.id, entry]));
  return buildStandings(detail.entries, detail.matches).map((row) => ({
    ...row,
    entry: byId.get(row.entryId)!,
  }));
}

/** Partido con ambos jugadores resueltos, para la vista de detalle. */
export async function getMatchDetail(matchId: string, communityId: string) {
  const supabase = await createClient();

  const { data: match } = await supabase
    .from("matches")
    .select("*, tournaments(*)")
    .eq("id", matchId)
    .maybeSingle();

  if (!match) notFound();

  const { tournaments, ...matchRow } = match as MatchRow & {
    tournaments: TournamentRow | null;
  };

  if (!tournaments || tournaments.community_id !== communityId) notFound();

  const entryIds = [matchRow.home_entry_id, matchRow.away_entry_id].filter(
    (id): id is string => Boolean(id),
  );

  const [{ data: entryRows }, { data: reportRows }, { data: disputeRows }] =
    await Promise.all([
      entryIds.length
        ? supabase
            .from("tournament_entries")
            .select("*, profiles(display_name)")
            .in("id", entryIds)
        : Promise.resolve({ data: [] as unknown[] }),
      supabase
        .from("match_reports")
        .select("*, profiles(display_name)")
        .eq("match_id", matchId)
        .order("created_at", { ascending: false }),
      supabase
        .from("disputes")
        .select("*, profiles!disputes_opened_by_fkey(display_name)")
        .eq("match_id", matchId)
        .order("created_at", { ascending: false }),
    ]);

  const entries = ((entryRows ?? []) as (EntryRow & {
    profiles: { display_name: string } | null;
  })[]).map((row) => toEntry(row, row.profiles?.display_name ?? row.gamertag));

  return {
    match: toMatch(matchRow as MatchRow),
    confirmedAt: matchRow.confirmed_at,
    tournament: tournaments,
    home: entries.find((entry) => entry.id === matchRow.home_entry_id) ?? null,
    away: entries.find((entry) => entry.id === matchRow.away_entry_id) ?? null,
    reports: (reportRows ?? []) as {
      id: string;
      reporter_id: string;
      home_score: number;
      away_score: number;
      screenshot_path: string | null;
      created_at: string;
      profiles: { display_name: string } | null;
    }[],
    disputes: (disputeRows ?? []) as {
      id: string;
      opened_by: string;
      reason: string;
      status: string;
      resolution_note: string | null;
      created_at: string;
      profiles: { display_name: string } | null;
    }[],
  };
}

/**
 * Tipos de la base de datos.
 *
 * Escritos a mano para que el proyecto arranque sin depender de la CLI. Cuando
 * el esquema cambie, regenerarlos con:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 */

export type CommunityRole = "owner" | "admin" | "player";
export type TournamentFormat = "league" | "cup" | "blitz";
export type GameMode = "ultimate_team" | "kick_off";
export type Platform = "ps5" | "xbox" | "pc";
export type TournamentStatus =
  | "draft"
  | "registration"
  | "in_progress"
  | "finished"
  | "cancelled";
export type MatchStatus =
  | "scheduled"
  | "awaiting_confirmation"
  | "confirmed"
  | "disputed"
  | "walkover";
export type MatchSlot = "home" | "away";
export type DisputeStatus = "open" | "resolved" | "rejected";

export type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  locale: string;
  created_at: string;
}

export type CommunityRow = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  brand_accent: string;
  default_locale: string;
  invite_code: string;
  is_public: boolean;
  plan: "free" | "pro";
  owner_id: string;
  created_at: string;
}

export type MembershipRow = {
  id: string;
  community_id: string;
  user_id: string;
  role: CommunityRole;
  gamertag: string | null;
  platform: Platform | null;
  joined_at: string;
}

export type TournamentRow = {
  id: string;
  community_id: string;
  name: string;
  format: TournamentFormat;
  game_mode: GameMode;
  game: string;
  /** Cupo máximo. `null` = sin límite de jugadores. */
  size: number | null;
  status: TournamentStatus;
  starts_at: string | null;
  /** Cierre de inscripciones. `null` = lo cierra el organizador a mano. */
  registration_closes_at: string | null;
  created_by: string;
  created_at: string;
}

export type EntryRow = {
  id: string;
  tournament_id: string;
  user_id: string;
  gamertag: string;
  platform: Platform;
  seed: number;
  created_at: string;
}

export type MatchRow = {
  id: string;
  tournament_id: string;
  round: number;
  position: number;
  home_entry_id: string | null;
  away_entry_id: string | null;
  home_score: number | null;
  away_score: number | null;
  status: MatchStatus;
  winner_entry_id: string | null;
  next_match_id: string | null;
  next_slot: MatchSlot | null;
  scheduled_at: string | null;
  confirmed_at: string | null;
  created_at: string;
}

export type MatchReportRow = {
  id: string;
  match_id: string;
  reporter_id: string;
  home_score: number;
  away_score: number;
  screenshot_path: string | null;
  created_at: string;
}

export type DisputeRow = {
  id: string;
  match_id: string;
  opened_by: string;
  reason: string;
  status: DisputeStatus;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export type CommunityMessageRow = {
  id: string;
  community_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export type PlayerStatsRow = {
  community_id: string;
  user_id: string;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  matches_on_time: number;
  no_shows: number;
  disputes_total: number;
  disputes_lost: number;
  updated_at: string;
}

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<
  Row,
  Insert = Partial<Row>,
  Relationships extends Relationship[] = [],
  Update = Partial<Row>,
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

/**
 * Claves foráneas declaradas.
 *
 * No son decorativas: postgrest-js las usa para tipar los joins embebidos
 * (`select("*, profiles(display_name)")`). Sin ellas, cada join se resuelve
 * como `SelectQueryError` y hay que castear a mano en cada consulta.
 * `foreignKeyName` debe coincidir con el nombre real de la restricción en
 * Postgres, porque es lo que permite desambiguar con `profiles!fk(...)` cuando
 * una tabla apunta dos veces a la misma.
 */
type FK<
  Name extends string,
  Column extends string,
  Referenced extends string,
> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Referenced;
  referencedColumns: ["id"];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      communities: Table<
        CommunityRow,
        Pick<CommunityRow, "slug" | "name" | "owner_id"> &
          Partial<Pick<CommunityRow, "logo_url" | "brand_accent" | "default_locale" | "is_public">>,
        [FK<"communities_owner_id_fkey", "owner_id", "profiles">]
      >;
      community_memberships: Table<
        MembershipRow,
        Pick<MembershipRow, "community_id" | "user_id"> &
          Partial<Pick<MembershipRow, "role" | "gamertag" | "platform">>,
        [
          FK<"community_memberships_community_id_fkey", "community_id", "communities">,
          FK<"community_memberships_user_id_fkey", "user_id", "profiles">,
        ]
      >;
      tournaments: Table<
        TournamentRow,
        Pick<
          TournamentRow,
          "community_id" | "name" | "format" | "game_mode" | "created_by"
        > &
          Partial<
            Pick<
              TournamentRow,
              "game" | "status" | "starts_at" | "size" | "registration_closes_at"
            >
          >,
        [
          FK<"tournaments_community_id_fkey", "community_id", "communities">,
          FK<"tournaments_created_by_fkey", "created_by", "profiles">,
        ]
      >;
      tournament_entries: Table<
        EntryRow,
        Pick<EntryRow, "tournament_id" | "user_id" | "gamertag" | "platform"> &
          Partial<Pick<EntryRow, "id" | "seed">>,
        [
          FK<"tournament_entries_tournament_id_fkey", "tournament_id", "tournaments">,
          FK<"tournament_entries_user_id_fkey", "user_id", "profiles">,
        ]
      >;
      matches: Table<
        MatchRow,
        Pick<MatchRow, "tournament_id" | "round" | "position"> &
          Partial<
            Pick<
              MatchRow,
              | "home_entry_id"
              | "away_entry_id"
              | "status"
              | "winner_entry_id"
              | "next_match_id"
              | "next_slot"
              | "scheduled_at"
            >
          >,
        [
          FK<"matches_tournament_id_fkey", "tournament_id", "tournaments">,
          FK<"matches_home_entry_id_fkey", "home_entry_id", "tournament_entries">,
          FK<"matches_away_entry_id_fkey", "away_entry_id", "tournament_entries">,
        ]
      >;
      match_reports: Table<
        MatchReportRow,
        Partial<MatchReportRow>,
        [
          FK<"match_reports_match_id_fkey", "match_id", "matches">,
          FK<"match_reports_reporter_id_fkey", "reporter_id", "profiles">,
        ]
      >;
      disputes: Table<
        DisputeRow,
        Partial<DisputeRow>,
        [
          FK<"disputes_match_id_fkey", "match_id", "matches">,
          // Dos claves foráneas hacia `profiles`: hay que nombrarlas al hacer el
          // join (`profiles!disputes_opened_by_fkey`) o postgrest no sabe cuál es.
          FK<"disputes_opened_by_fkey", "opened_by", "profiles">,
          FK<"disputes_resolved_by_fkey", "resolved_by", "profiles">,
        ]
      >;
      player_stats: Table<
        PlayerStatsRow,
        Partial<PlayerStatsRow>,
        [
          FK<"player_stats_community_id_fkey", "community_id", "communities">,
          FK<"player_stats_user_id_fkey", "user_id", "profiles">,
        ]
      >;
      community_messages: Table<
        CommunityMessageRow,
        Pick<CommunityMessageRow, "community_id" | "user_id" | "body">,
        [
          FK<"community_messages_community_id_fkey", "community_id", "communities">,
          FK<"community_messages_user_id_fkey", "user_id", "profiles">,
        ]
      >;
    };
    // `{ [_ in never]: never }` y no `Record<string, never>`: este último no
    // satisface la restricción `GenericSchema` de supabase-js y hace que todas
    // las consultas se tipen como `never`.
    Views: { [_ in never]: never };
    Functions: {
      join_community_by_code: {
        Args: { p_code: string };
        Returns: { community_id: string; slug: string; name: string }[];
      };
      submit_match_report: {
        Args: {
          p_match_id: string;
          p_home_score: number;
          p_away_score: number;
          p_screenshot_path?: string | null;
        };
        Returns: MatchStatus;
      };
      confirm_match: {
        Args: { p_match_id: string };
        Returns: MatchStatus;
      };
      open_dispute: {
        Args: { p_match_id: string; p_reason: string };
        Returns: string;
      };
      resolve_dispute: {
        Args: {
          p_dispute_id: string;
          p_home_score: number;
          p_away_score: number;
          p_uphold: boolean;
          p_note?: string | null;
        };
        Returns: undefined;
      };
      declare_walkover: {
        Args: { p_match_id: string; p_winner_entry_id: string };
        Returns: undefined;
      };
      is_platform_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      admin_list_users: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          email: string;
          display_name: string;
          is_admin: boolean;
          communities_owned: number;
          memberships: number;
          created_at: string;
        }[];
      };
      admin_delete_user: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      admin_delete_community: {
        Args: { p_community_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      community_role: CommunityRole;
      tournament_format: TournamentFormat;
      game_mode: GameMode;
      platform: Platform;
      tournament_status: TournamentStatus;
      match_status: MatchStatus;
      match_slot: MatchSlot;
      dispute_status: DisputeStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
}

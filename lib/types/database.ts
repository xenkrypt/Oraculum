export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type DbTable<
  Row extends Record<string, unknown>,
  Insert extends Record<string, unknown>,
  Update extends Record<string, unknown>,
  Relationships extends Relationship[] = []
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

export type Database = {
  public: {
    Tables: {
      users: DbTable<
        {
          id: string;
          email: string | null;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          email?: string | null;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          email?: string | null;
          display_name?: string | null;
          updated_at?: string;
        }
      >;
      sessions: DbTable<
        {
          id: string;
          user_id: string;
          status: "in_progress" | "completed" | "abandoned";
          started_at: string;
          completed_at: string | null;
          metadata: Json;
        },
        {
          id?: string;
          user_id: string;
          status?: "in_progress" | "completed" | "abandoned";
          started_at?: string;
          completed_at?: string | null;
          metadata?: Json;
        },
        {
          status?: "in_progress" | "completed" | "abandoned";
          completed_at?: string | null;
          metadata?: Json;
        },
        [
          {
            foreignKeyName: "sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ]
      >;
      challenge_definitions: DbTable<
        {
          id: string;
          slug: string;
          title: string;
          type: string;
          config: Json;
          active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          slug: string;
          title: string;
          type: string;
          config?: Json;
          active?: boolean;
          sort_order?: number;
        },
        {
          slug?: string;
          title?: string;
          type?: string;
          config?: Json;
          active?: boolean;
          sort_order?: number;
          updated_at?: string;
        }
      >;
      challenge_responses: DbTable<
        {
          id: string;
          user_id: string;
          session_id: string;
          challenge_id: string;
          raw_response: Json;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          session_id: string;
          challenge_id: string;
          raw_response: Json;
        },
        {
          raw_response?: Json;
          updated_at?: string;
        },
        [
          {
            foreignKeyName: "challenge_responses_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: false;
            referencedRelation: "challenge_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "challenge_responses_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "challenge_responses_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ]
      >;
      talent_profiles: DbTable<
        {
          id: string;
          user_id: string;
          session_id: string;
          dimension_scores: Json;
          summary_text: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          session_id: string;
          dimension_scores: Json;
          summary_text: string;
        },
        {
          dimension_scores?: Json;
          summary_text?: string;
          updated_at?: string;
        },
        [
          {
            foreignKeyName: "talent_profiles_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: true;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "talent_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ]
      >;
      future_paths: DbTable<
        {
          id: string;
          user_id: string;
          session_id: string;
          paths: Json;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          session_id: string;
          paths: Json;
        },
        {
          paths?: Json;
          updated_at?: string;
        },
        [
          {
            foreignKeyName: "future_paths_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: true;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "future_paths_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ]
      >;
      user_events: DbTable<
        {
          id: string;
          user_id: string;
          session_id: string | null;
          type: string;
          payload: Json;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          session_id?: string | null;
          type: string;
          payload?: Json;
          created_at?: string;
        },
        Record<string, never>,
        [
          {
            foreignKeyName: "user_events_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ]
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

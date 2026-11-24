import "server-only";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      chapters: {
        Row: {
          course_id: string;
          id: string;
          position: number;
          summary: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          course_id: string;
          id?: string;
          position?: number;
          summary?: string;
          title: string;
        };
        Update: {
          course_id?: string;
          id?: string;
          position?: number;
          summary?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chapters_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
        ];
      };
      completions: {
        Row: {
          code: string;
          completed_at: string;
          lesson_id: string;
          user_id: string;
          xp: number;
        };
        ComputedFields: never;
        Insert: {
          code?: string;
          completed_at?: string;
          lesson_id: string;
          user_id: string;
          xp: number;
        };
        Update: {
          code?: string;
          completed_at?: string;
          lesson_id?: string;
          user_id?: string;
          xp?: number;
        };
        Relationships: [
          {
            foreignKeyName: "completions_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      courses: {
        Row: {
          created_at: string;
          id: string;
          outcomes: NonNullable<Json>;
          position: number;
          slug: string;
          status: string;
          summary: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          outcomes?: NonNullable<Json>;
          position?: number;
          slug: string;
          status?: string;
          summary: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          outcomes?: NonNullable<Json>;
          position?: number;
          slug?: string;
          status?: string;
          summary?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lesson_solutions: {
        Row: {
          lesson_id: string;
          solution_code: string;
          updated_at: string;
          wrong_answers: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          lesson_id: string;
          solution_code?: string;
          updated_at?: string;
          wrong_answers?: NonNullable<Json>;
        };
        Update: {
          lesson_id?: string;
          solution_code?: string;
          updated_at?: string;
          wrong_answers?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_solutions_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: true;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      lessons: {
        Row: {
          chapter_id: string;
          course_id: string;
          created_at: string;
          gradable_changed_at: string;
          hints: NonNullable<Json>;
          id: string;
          instructions_md: string;
          position: number;
          published_at: string | null;
          slug: string;
          starter_code: string;
          status: string;
          tests: NonNullable<Json>;
          title: string;
          updated_at: string;
          validated_at: string | null;
          xp: number;
        };
        ComputedFields: never;
        Insert: {
          chapter_id: string;
          course_id: string;
          created_at?: string;
          gradable_changed_at?: string;
          hints?: NonNullable<Json>;
          id?: string;
          instructions_md?: string;
          position?: number;
          published_at?: string | null;
          slug: string;
          starter_code?: string;
          status?: string;
          tests?: NonNullable<Json>;
          title: string;
          updated_at?: string;
          validated_at?: string | null;
          xp?: number;
        };
        Update: {
          chapter_id?: string;
          course_id?: string;
          created_at?: string;
          gradable_changed_at?: string;
          hints?: NonNullable<Json>;
          id?: string;
          instructions_md?: string;
          position?: number;
          published_at?: string | null;
          slug?: string;
          starter_code?: string;
          status?: string;
          tests?: NonNullable<Json>;
          title?: string;
          updated_at?: string;
          validated_at?: string | null;
          xp?: number;
        };
        Relationships: [
          {
            foreignKeyName: "lessons_chapter_id_course_id_fkey";
            columns: ["chapter_id", "course_id"];
            isOneToOne: false;
            referencedRelation: "chapters";
            referencedColumns: ["id", "course_id"];
          },
          {
            foreignKeyName: "lessons_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          time_zone: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name: string;
          time_zone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          time_zone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      lesson_completion_counts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          completions: number;
          lesson_id: string;
        }[];
      };
      save_lesson: {
        Args: {
          p_chapter_id: string;
          p_hints: Json;
          p_instructions_md: string;
          p_lesson_id: string;
          p_loaded_updated_at: string;
          p_position: number;
          p_slug: string;
          p_solution_code: string;
          p_starter_code: string;
          p_tests: Json;
          p_title: string;
          p_validated: boolean;
          p_wrong_answers: Json;
          p_xp: number;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

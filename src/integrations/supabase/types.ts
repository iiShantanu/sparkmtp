export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_configs: {
        Row: {
          complexity: string
          created_at: string
          custom_prompt: string
          id: string
          language: string
          mode: Database["public"]["Enums"]["ai_mode"]
          owner_id: string
          scope: Database["public"]["Enums"]["ai_scope"]
          scope_id: string | null
          subject_id: string | null
          subject_instructions: Json
          teaching_style: string
          tone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          complexity?: string
          created_at?: string
          custom_prompt?: string
          id?: string
          language?: string
          mode?: Database["public"]["Enums"]["ai_mode"]
          owner_id: string
          scope: Database["public"]["Enums"]["ai_scope"]
          scope_id?: string | null
          subject_id?: string | null
          subject_instructions?: Json
          teaching_style?: string
          tone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          complexity?: string
          created_at?: string
          custom_prompt?: string
          id?: string
          language?: string
          mode?: Database["public"]["Enums"]["ai_mode"]
          owner_id?: string
          scope?: Database["public"]["Enums"]["ai_scope"]
          scope_id?: string | null
          subject_id?: string | null
          subject_instructions?: Json
          teaching_style?: string
          tone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_configs_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          diff: Json | null
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          diff?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          diff?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          created_at: string
          id: string
          name: string
          school_id: string | null
          section: string | null
          teacher_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          school_id?: string | null
          section?: string | null
          teacher_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          school_id?: string | null
          section?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_goals: {
        Row: {
          completed_at: string | null
          created_at: string
          goal_date: string
          id: string
          set_by_user_id: string | null
          source: string
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          goal_date: string
          id?: string
          set_by_user_id?: string | null
          source?: string
          student_id: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          goal_date?: string
          id?: string
          set_by_user_id?: string | null
          source?: string
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_goals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          claimed: boolean
          created_at: string
          created_by: string | null
          id: string
          last_seen_at: string | null
          name: string | null
          paired_at: string | null
          pairing_code: string | null
          student_id: string | null
          token_hash: string | null
        }
        Insert: {
          claimed?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          last_seen_at?: string | null
          name?: string | null
          paired_at?: string | null
          pairing_code?: string | null
          student_id?: string | null
          token_hash?: string | null
        }
        Update: {
          claimed?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          last_seen_at?: string | null
          name?: string | null
          paired_at?: string | null
          pairing_code?: string | null
          student_id?: string | null
          token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      homework: {
        Row: {
          class_id: string | null
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          due_at: string | null
          id: string
          instructions: string | null
          subject: string
          subject_id: string | null
          teacher_id: string
          title: string
          updated_at: string
          voice_enabled: boolean
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          due_at?: string | null
          id?: string
          instructions?: string | null
          subject: string
          subject_id?: string | null
          teacher_id: string
          title: string
          updated_at?: string
          voice_enabled?: boolean
        }
        Update: {
          class_id?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          due_at?: string | null
          id?: string
          instructions?: string | null
          subject?: string
          subject_id?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
          voice_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "homework_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_assignments: {
        Row: {
          completed_at: string | null
          created_at: string
          homework_id: string
          id: string
          score: number | null
          status: Database["public"]["Enums"]["homework_status"]
          student_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          homework_id: string
          id?: string
          score?: number | null
          status?: Database["public"]["Enums"]["homework_status"]
          student_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          homework_id?: string
          id?: string
          score?: number | null
          status?: Database["public"]["Enums"]["homework_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_assignments_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      interaction_logs: {
        Row: {
          ai_response: string | null
          created_at: string
          device_id: string | null
          difficulty: Database["public"]["Enums"]["difficulty_level"] | null
          duration_sec: number | null
          homework_id: string | null
          id: string
          needs_intervention: boolean
          question: string
          student_id: string
          subject: string | null
          topic: string | null
          transcript: string | null
        }
        Insert: {
          ai_response?: string | null
          created_at?: string
          device_id?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          duration_sec?: number | null
          homework_id?: string | null
          id?: string
          needs_intervention?: boolean
          question: string
          student_id: string
          subject?: string | null
          topic?: string | null
          transcript?: string | null
        }
        Update: {
          ai_response?: string | null
          created_at?: string
          device_id?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          duration_sec?: number | null
          homework_id?: string | null
          id?: string
          needs_intervention?: boolean
          question?: string
          student_id?: string
          subject?: string | null
          topic?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interaction_logs_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          payload: Json
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          id?: string
          payload?: Json
          role: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          payload?: Json
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: []
      }
      learning_streaks: {
        Row: {
          current_streak: number
          last_active_date: string | null
          longest_streak: number
          student_id: string
          updated_at: string
        }
        Insert: {
          current_streak?: number
          last_active_date?: string | null
          longest_streak?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          current_streak?: number
          last_active_date?: string | null
          longest_streak?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_streaks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          body: string | null
          class_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          kind: string
          starts_at: string
          student_id: string | null
          subject_id: string | null
          teacher_id: string
          title: string
        }
        Insert: {
          body?: string | null
          class_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          starts_at?: string
          student_id?: string | null
          subject_id?: string | null
          teacher_id: string
          title: string
        }
        Update: {
          body?: string | null
          class_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          starts_at?: string
          student_id?: string | null
          subject_id?: string | null
          teacher_id?: string
          title?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          recipient_user_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          recipient_user_id: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          recipient_user_id?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      parent_students: {
        Row: {
          created_at: string
          id: string
          parent_user_id: string
          relationship: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_user_id: string
          relationship?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_user_id?: string
          relationship?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          score: number | null
          started_at: string
          student_id: string
          subject: string | null
          topic: string | null
          total: number | null
          transcript: string | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          score?: number | null
          started_at?: string
          student_id: string
          subject?: string | null
          topic?: string | null
          total?: number | null
          transcript?: string | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          score?: number | null
          started_at?: string
          student_id?: string
          subject?: string | null
          topic?: string | null
          total?: number | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      student_learning_profile: {
        Row: {
          current_focus: string | null
          last_session_summary: string | null
          strong_topics: string[]
          student_id: string
          unresolved_doubts: Json
          updated_at: string
          weak_topics: string[]
        }
        Insert: {
          current_focus?: string | null
          last_session_summary?: string | null
          strong_topics?: string[]
          student_id: string
          unresolved_doubts?: Json
          updated_at?: string
          weak_topics?: string[]
        }
        Update: {
          current_focus?: string | null
          last_session_summary?: string | null
          strong_topics?: string[]
          student_id?: string
          unresolved_doubts?: Json
          updated_at?: string
          weak_topics?: string[]
        }
        Relationships: []
      }
      student_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          sender_role: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_role: string
          student_id: string
          teacher_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_role?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_messages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          avatar_url: string | null
          class_id: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          full_name: string
          id: string
          profile_id: string | null
          roll_number: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          full_name: string
          id?: string
          profile_id?: string | null
          roll_number?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          full_name?: string
          id?: string
          profile_id?: string | null
          roll_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          actual_minutes: number
          created_at: string
          ended_at: string | null
          id: string
          kind: string
          planned_minutes: number
          started_at: string
          student_id: string
        }
        Insert: {
          actual_minutes?: number
          created_at?: string
          ended_at?: string | null
          id?: string
          kind: string
          planned_minutes?: number
          started_at?: string
          student_id: string
        }
        Update: {
          actual_minutes?: number
          created_at?: string
          ended_at?: string | null
          id?: string
          kind?: string
          planned_minutes?: number
          started_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      teacher_subjects: {
        Row: {
          class_id: string | null
          created_at: string
          id: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          id?: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          id?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      is_student_parent: { Args: { _student_id: string }; Returns: boolean }
      is_student_teacher: { Args: { _student_id: string }; Returns: boolean }
      teacher_can_see_class: { Args: { _class_id: string }; Returns: boolean }
      teacher_can_see_student: {
        Args: { _student_id: string }
        Returns: boolean
      }
      teacher_teaches: {
        Args: { _class_id: string; _subject_id: string }
        Returns: boolean
      }
    }
    Enums: {
      ai_mode: "guided" | "step_by_step" | "hint_only" | "direct"
      ai_scope: "global" | "class" | "student" | "subject"
      app_role: "teacher" | "parent" | "admin" | "student"
      approval_status: "pending" | "approved" | "rejected"
      difficulty_level: "easy" | "medium" | "hard"
      homework_status: "assigned" | "in_progress" | "completed" | "overdue"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ai_mode: ["guided", "step_by_step", "hint_only", "direct"],
      ai_scope: ["global", "class", "student", "subject"],
      app_role: ["teacher", "parent", "admin", "student"],
      approval_status: ["pending", "approved", "rejected"],
      difficulty_level: ["easy", "medium", "hard"],
      homework_status: ["assigned", "in_progress", "completed", "overdue"],
    },
  },
} as const

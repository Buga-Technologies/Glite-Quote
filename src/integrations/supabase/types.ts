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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      additional_services: {
        Row: {
          cost: number
          created_at: string
          id: string
          is_default: boolean | null
          service_name: string
          updated_at: string
        }
        Insert: {
          cost: number
          created_at?: string
          id?: string
          is_default?: boolean | null
          service_name: string
          updated_at?: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          is_default?: boolean | null
          service_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          id: string
          password_hash: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          password_hash: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          password_hash?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      bhr_settings: {
        Row: {
          created_at: string
          id: string
          rate_per_hour: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          rate_per_hour?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          rate_per_hour?: number
          updated_at?: string
        }
        Relationships: []
      }
      cover_costs: {
        Row: {
          cost: number
          cover_type: string
          created_at: string
          id: string
          size: string
          updated_at: string
        }
        Insert: {
          cost: number
          cover_type: string
          created_at?: string
          id?: string
          size: string
          updated_at?: string
        }
        Update: {
          cost?: number
          cover_type?: string
          created_at?: string
          id?: string
          size?: string
          updated_at?: string
        }
        Relationships: []
      }
      finishing_costs: {
        Row: {
          cost: number
          created_at: string
          id: string
          page_range_max: number | null
          page_range_min: number
          updated_at: string
        }
        Insert: {
          cost: number
          created_at?: string
          id?: string
          page_range_max?: number | null
          page_range_min: number
          updated_at?: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          page_range_max?: number | null
          page_range_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      packaging_costs: {
        Row: {
          cost: number
          created_at: string
          id: string
          size: string
          updated_at: string
        }
        Insert: {
          cost: number
          created_at?: string
          id?: string
          size: string
          updated_at?: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          size?: string
          updated_at?: string
        }
        Relationships: []
      }
      paper_costs: {
        Row: {
          cost_per_page: number
          created_at: string
          id: string
          paper_type: string
          size: string
          updated_at: string
        }
        Insert: {
          cost_per_page: number
          created_at?: string
          id?: string
          paper_type: string
          size: string
          updated_at?: string
        }
        Update: {
          cost_per_page?: number
          created_at?: string
          id?: string
          paper_type?: string
          size?: string
          updated_at?: string
        }
        Relationships: []
      }
      profit_margins: {
        Row: {
          copies_max: number | null
          copies_min: number
          created_at: string
          id: string
          margin_percentage_1: number
          margin_percentage_2: number | null
          updated_at: string
        }
        Insert: {
          copies_max?: number | null
          copies_min: number
          created_at?: string
          id?: string
          margin_percentage_1: number
          margin_percentage_2?: number | null
          updated_at?: string
        }
        Update: {
          copies_max?: number | null
          copies_min?: number
          created_at?: string
          id?: string
          margin_percentage_1?: number
          margin_percentage_2?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      toner_costs: {
        Row: {
          color_type: string
          cost_per_page: number
          created_at: string
          id: string
          size: string
          updated_at: string
        }
        Insert: {
          color_type: string
          cost_per_page: number
          created_at?: string
          id?: string
          size: string
          updated_at?: string
        }
        Update: {
          color_type?: string
          cost_per_page?: number
          created_at?: string
          id?: string
          size?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

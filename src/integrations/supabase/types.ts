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
      earnings_calendar: {
        Row: {
          category: string | null
          company_name: string
          created_at: string
          earnings_date: string
          earnings_time: string | null
          expected_eps: number | null
          id: string
          importance_score: number | null
          is_crypto_related: boolean | null
          social_sentiment: number | null
          stock_symbol: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          company_name: string
          created_at?: string
          earnings_date: string
          earnings_time?: string | null
          expected_eps?: number | null
          id?: string
          importance_score?: number | null
          is_crypto_related?: boolean | null
          social_sentiment?: number | null
          stock_symbol: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          company_name?: string
          created_at?: string
          earnings_date?: string
          earnings_time?: string | null
          expected_eps?: number | null
          id?: string
          importance_score?: number | null
          is_crypto_related?: boolean | null
          social_sentiment?: number | null
          stock_symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_alerts: {
        Row: {
          alert_message: string
          alert_type: string
          asset_name: string
          asset_symbol: string
          created_at: string
          current_value: number | null
          id: string
          is_active: boolean | null
          resolved_at: string | null
          severity: string | null
          trigger_value: number | null
        }
        Insert: {
          alert_message: string
          alert_type: string
          asset_name: string
          asset_symbol: string
          created_at?: string
          current_value?: number | null
          id?: string
          is_active?: boolean | null
          resolved_at?: string | null
          severity?: string | null
          trigger_value?: number | null
        }
        Update: {
          alert_message?: string
          alert_type?: string
          asset_name?: string
          asset_symbol?: string
          created_at?: string
          current_value?: number | null
          id?: string
          is_active?: boolean | null
          resolved_at?: string | null
          severity?: string | null
          trigger_value?: number | null
        }
        Relationships: []
      }
      market_briefs: {
        Row: {
          brief_type: string
          content_sections: Json
          created_at: string
          executive_summary: string
          featured_assets: string[] | null
          id: string
          is_published: boolean | null
          market_data: Json | null
          published_at: string | null
          sentiment_score: number | null
          slug: string
          social_data: Json | null
          stoic_quote: string | null
          title: string
          updated_at: string
          view_count: number | null
        }
        Insert: {
          brief_type: string
          content_sections?: Json
          created_at?: string
          executive_summary: string
          featured_assets?: string[] | null
          id?: string
          is_published?: boolean | null
          market_data?: Json | null
          published_at?: string | null
          sentiment_score?: number | null
          slug: string
          social_data?: Json | null
          stoic_quote?: string | null
          title: string
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          brief_type?: string
          content_sections?: Json
          created_at?: string
          executive_summary?: string
          featured_assets?: string[] | null
          id?: string
          is_published?: boolean | null
          market_data?: Json | null
          published_at?: string | null
          sentiment_score?: number | null
          slug?: string
          social_data?: Json | null
          stoic_quote?: string | null
          title?: string
          updated_at?: string
          view_count?: number | null
        }
        Relationships: []
      }
      social_sentiment: {
        Row: {
          asset_name: string
          asset_symbol: string
          created_at: string
          data_timestamp: string
          galaxy_score: number | null
          id: string
          sentiment_score: number
          social_volume: number | null
          social_volume_24h_change: number | null
          top_influencers: Json | null
          trending_rank: number | null
          viral_posts: Json | null
        }
        Insert: {
          asset_name: string
          asset_symbol: string
          created_at?: string
          data_timestamp?: string
          galaxy_score?: number | null
          id?: string
          sentiment_score: number
          social_volume?: number | null
          social_volume_24h_change?: number | null
          top_influencers?: Json | null
          trending_rank?: number | null
          viral_posts?: Json | null
        }
        Update: {
          asset_name?: string
          asset_symbol?: string
          created_at?: string
          data_timestamp?: string
          galaxy_score?: number | null
          id?: string
          sentiment_score?: number
          social_volume?: number | null
          social_volume_24h_change?: number | null
          top_influencers?: Json | null
          trending_rank?: number | null
          viral_posts?: Json | null
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

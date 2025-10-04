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
      cache_kv: {
        Row: {
          created_at: string
          expires_at: string
          k: string
          v: Json
        }
        Insert: {
          created_at?: string
          expires_at: string
          k: string
          v: Json
        }
        Update: {
          created_at?: string
          expires_at?: string
          k?: string
          v?: Json
        }
        Relationships: []
      }
      cg_master: {
        Row: {
          cg_id: string
          created_at: string | null
          id: string
          name: string
          platforms: Json | null
          symbol: string
          synced_at: string | null
        }
        Insert: {
          cg_id: string
          created_at?: string | null
          id?: string
          name: string
          platforms?: Json | null
          symbol: string
          synced_at?: string | null
        }
        Update: {
          cg_id?: string
          created_at?: string | null
          id?: string
          name?: string
          platforms?: Json | null
          symbol?: string
          synced_at?: string | null
        }
        Relationships: []
      }
      daily_quotes: {
        Row: {
          author: string
          brief_id: string | null
          brief_type: string
          created_at: string
          id: string
          quote_text: string
          source: string
          used_date: string
        }
        Insert: {
          author: string
          brief_id?: string | null
          brief_type: string
          created_at?: string
          id?: string
          quote_text: string
          source: string
          used_date: string
        }
        Update: {
          author?: string
          brief_id?: string | null
          brief_type?: string
          created_at?: string
          id?: string
          quote_text?: string
          source?: string
          used_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_quotes_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "market_briefs"
            referencedColumns: ["id"]
          },
        ]
      }
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
      exchange_pairs: {
        Row: {
          base_asset: string
          created_at: string | null
          exchange: string
          id: string
          is_active: boolean | null
          quote_asset: string
          symbol: string
          synced_at: string | null
        }
        Insert: {
          base_asset: string
          created_at?: string | null
          exchange: string
          id?: string
          is_active?: boolean | null
          quote_asset: string
          symbol: string
          synced_at?: string | null
        }
        Update: {
          base_asset?: string
          created_at?: string | null
          exchange?: string
          id?: string
          is_active?: boolean | null
          quote_asset?: string
          symbol?: string
          synced_at?: string | null
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
      market_brief_audits: {
        Row: {
          brief_id: string | null
          created_at: string
          id: string
          missing_symbols: string[]
          notes: string | null
          provider_status: Json
        }
        Insert: {
          brief_id?: string | null
          created_at?: string
          id?: string
          missing_symbols?: string[]
          notes?: string | null
          provider_status?: Json
        }
        Update: {
          brief_id?: string | null
          created_at?: string
          id?: string
          missing_symbols?: string[]
          notes?: string | null
          provider_status?: Json
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
          stoic_quote_author: string | null
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
          stoic_quote_author?: string | null
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
          stoic_quote_author?: string | null
          title?: string
          updated_at?: string
          view_count?: number | null
        }
        Relationships: []
      }
      missing_symbols: {
        Row: {
          context: Json | null
          created_at: string | null
          first_seen_at: string | null
          id: string
          last_seen_at: string | null
          normalized_symbol: string
          occurrence_count: number | null
          resolved: boolean | null
          resolved_at: string | null
          symbol: string
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          normalized_symbol: string
          occurrence_count?: number | null
          resolved?: boolean | null
          resolved_at?: string | null
          symbol: string
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          normalized_symbol?: string
          occurrence_count?: number | null
          resolved?: boolean | null
          resolved_at?: string | null
          symbol?: string
        }
        Relationships: []
      }
      pending_ticker_mappings: {
        Row: {
          aliases: string[] | null
          auto_approved: boolean | null
          coingecko_id: string | null
          confidence_score: number | null
          context: Json | null
          created_at: string | null
          display_name: string | null
          id: string
          match_type: string | null
          normalized_symbol: string
          polygon_ticker: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          seen_count: number | null
          status: string | null
          symbol: string
          tradingview_symbol: string | null
          updated_at: string | null
          validation_notes: string | null
        }
        Insert: {
          aliases?: string[] | null
          auto_approved?: boolean | null
          coingecko_id?: string | null
          confidence_score?: number | null
          context?: Json | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          match_type?: string | null
          normalized_symbol: string
          polygon_ticker?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seen_count?: number | null
          status?: string | null
          symbol: string
          tradingview_symbol?: string | null
          updated_at?: string | null
          validation_notes?: string | null
        }
        Update: {
          aliases?: string[] | null
          auto_approved?: boolean | null
          coingecko_id?: string | null
          confidence_score?: number | null
          context?: Json | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          match_type?: string | null
          normalized_symbol?: string
          polygon_ticker?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seen_count?: number | null
          status?: string | null
          symbol?: string
          tradingview_symbol?: string | null
          updated_at?: string | null
          validation_notes?: string | null
        }
        Relationships: []
      }
      poly_fx_pairs: {
        Row: {
          active: boolean | null
          base_currency: string
          created_at: string | null
          id: string
          name: string
          quote_currency: string
          synced_at: string | null
          ticker: string
        }
        Insert: {
          active?: boolean | null
          base_currency: string
          created_at?: string | null
          id?: string
          name: string
          quote_currency: string
          synced_at?: string | null
          ticker: string
        }
        Update: {
          active?: boolean | null
          base_currency?: string
          created_at?: string | null
          id?: string
          name?: string
          quote_currency?: string
          synced_at?: string | null
          ticker?: string
        }
        Relationships: []
      }
      poly_tickers: {
        Row: {
          active: boolean | null
          base_currency_name: string | null
          base_currency_symbol: string | null
          created_at: string | null
          currency_name: string | null
          delisted_utc: string | null
          id: string
          last_updated_utc: string | null
          locale: string | null
          market: string
          name: string
          primary_exchange: string | null
          synced_at: string | null
          ticker: string
          type: string | null
        }
        Insert: {
          active?: boolean | null
          base_currency_name?: string | null
          base_currency_symbol?: string | null
          created_at?: string | null
          currency_name?: string | null
          delisted_utc?: string | null
          id?: string
          last_updated_utc?: string | null
          locale?: string | null
          market: string
          name: string
          primary_exchange?: string | null
          synced_at?: string | null
          ticker: string
          type?: string | null
        }
        Update: {
          active?: boolean | null
          base_currency_name?: string | null
          base_currency_symbol?: string | null
          created_at?: string | null
          currency_name?: string | null
          delisted_utc?: string | null
          id?: string
          last_updated_utc?: string | null
          locale?: string | null
          market?: string
          name?: string
          primary_exchange?: string | null
          synced_at?: string | null
          ticker?: string
          type?: string | null
        }
        Relationships: []
      }
      quote_library: {
        Row: {
          author: string
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          last_used_at: string | null
          quote_text: string
          times_used: number
        }
        Insert: {
          author: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          quote_text: string
          times_used?: number
        }
        Update: {
          author?: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          quote_text?: string
          times_used?: number
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
      ticker_mappings: {
        Row: {
          aliases: string[] | null
          alpha_symbol: string | null
          coingecko_id: string | null
          coinglass_symbol: string | null
          created_at: string
          derivs_supported: boolean | null
          dex_address: string | null
          dex_chain: string | null
          display_name: string
          display_symbol: string | null
          exchange: string | null
          finnhub_symbol: string | null
          id: string
          is_active: boolean
          polygon_ticker: string | null
          preferred_exchange: string | null
          price_supported: boolean | null
          primary_stock_provider: string | null
          social_supported: boolean | null
          symbol: string
          tradingview_supported: boolean | null
          tradingview_symbol: string
          type: string
          updated_at: string
        }
        Insert: {
          aliases?: string[] | null
          alpha_symbol?: string | null
          coingecko_id?: string | null
          coinglass_symbol?: string | null
          created_at?: string
          derivs_supported?: boolean | null
          dex_address?: string | null
          dex_chain?: string | null
          display_name: string
          display_symbol?: string | null
          exchange?: string | null
          finnhub_symbol?: string | null
          id?: string
          is_active?: boolean
          polygon_ticker?: string | null
          preferred_exchange?: string | null
          price_supported?: boolean | null
          primary_stock_provider?: string | null
          social_supported?: boolean | null
          symbol: string
          tradingview_supported?: boolean | null
          tradingview_symbol: string
          type: string
          updated_at?: string
        }
        Update: {
          aliases?: string[] | null
          alpha_symbol?: string | null
          coingecko_id?: string | null
          coinglass_symbol?: string | null
          created_at?: string
          derivs_supported?: boolean | null
          dex_address?: string | null
          dex_chain?: string | null
          display_name?: string
          display_symbol?: string | null
          exchange?: string | null
          finnhub_symbol?: string | null
          id?: string
          is_active?: boolean
          polygon_ticker?: string | null
          preferred_exchange?: string | null
          price_supported?: boolean | null
          primary_stock_provider?: string | null
          social_supported?: boolean | null
          symbol?: string
          tradingview_supported?: boolean | null
          tradingview_symbol?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_approve_pending_mappings: {
        Args: Record<PropertyKey, never>
        Returns: {
          approved_count: number
          rejected_count: number
        }[]
      }
      calculate_confidence: {
        Args: {
          p_has_alias?: boolean
          p_match_type: string
          p_name_similarity?: number
          p_tv_validated?: boolean
        }
        Returns: number
      }
      cleanup_expired_cache: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      norm_symbol: {
        Args: { raw_symbol: string }
        Returns: string
      }
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

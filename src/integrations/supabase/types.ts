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
      ai_usage_logs: {
        Row: {
          assets_queried: string[] | null
          client_ip: string | null
          created_at: string | null
          data_sources_used: string[] | null
          error_code: string | null
          estimated_cost_millicents: number
          fallback_from: string | null
          fallback_used: boolean | null
          id: string
          input_tokens: number
          intent: string | null
          latency_ms: number | null
          model: string
          output_tokens: number
          provider: string
          question_type: string[] | null
          session_id: string | null
          success: boolean | null
          tool_latency_ms: Json | null
          tools_used: Json | null
          total_latency_ms: number | null
          total_tokens: number | null
          user_message_preview: string | null
        }
        Insert: {
          assets_queried?: string[] | null
          client_ip?: string | null
          created_at?: string | null
          data_sources_used?: string[] | null
          error_code?: string | null
          estimated_cost_millicents?: number
          fallback_from?: string | null
          fallback_used?: boolean | null
          id?: string
          input_tokens?: number
          intent?: string | null
          latency_ms?: number | null
          model: string
          output_tokens?: number
          provider: string
          question_type?: string[] | null
          session_id?: string | null
          success?: boolean | null
          tool_latency_ms?: Json | null
          tools_used?: Json | null
          total_latency_ms?: number | null
          total_tokens?: number | null
          user_message_preview?: string | null
        }
        Update: {
          assets_queried?: string[] | null
          client_ip?: string | null
          created_at?: string | null
          data_sources_used?: string[] | null
          error_code?: string | null
          estimated_cost_millicents?: number
          fallback_from?: string | null
          fallback_used?: boolean | null
          id?: string
          input_tokens?: number
          intent?: string | null
          latency_ms?: number | null
          model?: string
          output_tokens?: number
          provider?: string
          question_type?: string[] | null
          session_id?: string | null
          success?: boolean | null
          tool_latency_ms?: Json | null
          tools_used?: Json | null
          total_latency_ms?: number | null
          total_tokens?: number | null
          user_message_preview?: string | null
        }
        Relationships: []
      }
      asset_sentiment_snapshots: {
        Row: {
          asset_name: string
          asset_symbol: string
          asset_type: string | null
          created_at: string | null
          id: string
          negative_count: number
          neutral_count: number
          polygon_articles_count: number | null
          positive_count: number
          score_change: number | null
          sentiment_label: string
          sentiment_score: number
          timestamp: string
          top_keywords: string[] | null
          total_articles: number
          trend_direction: string | null
        }
        Insert: {
          asset_name: string
          asset_symbol: string
          asset_type?: string | null
          created_at?: string | null
          id?: string
          negative_count?: number
          neutral_count?: number
          polygon_articles_count?: number | null
          positive_count?: number
          score_change?: number | null
          sentiment_label: string
          sentiment_score: number
          timestamp?: string
          top_keywords?: string[] | null
          total_articles?: number
          trend_direction?: string | null
        }
        Update: {
          asset_name?: string
          asset_symbol?: string
          asset_type?: string | null
          created_at?: string | null
          id?: string
          negative_count?: number
          neutral_count?: number
          polygon_articles_count?: number | null
          positive_count?: number
          score_change?: number | null
          sentiment_label?: string
          sentiment_score?: number
          timestamp?: string
          top_keywords?: string[] | null
          total_articles?: number
          trend_direction?: string | null
        }
        Relationships: []
      }
      assets: {
        Row: {
          active: boolean | null
          created_at: string | null
          display_symbol: string | null
          id: string
          logo_url: string | null
          market: string | null
          name: string
          provider: string | null
          symbol: string
          type: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          display_symbol?: string | null
          id?: string
          logo_url?: string | null
          market?: string | null
          name: string
          provider?: string | null
          symbol: string
          type: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          display_symbol?: string | null
          id?: string
          logo_url?: string | null
          market?: string | null
          name?: string
          provider?: string | null
          symbol?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
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
          enriched_at: string | null
          enrichment_error: string | null
          enrichment_status: string | null
          id: string
          name: string
          platforms: Json | null
          symbol: string
          synced_at: string | null
        }
        Insert: {
          cg_id: string
          created_at?: string | null
          enriched_at?: string | null
          enrichment_error?: string | null
          enrichment_status?: string | null
          id?: string
          name: string
          platforms?: Json | null
          symbol: string
          synced_at?: string | null
        }
        Update: {
          cg_id?: string
          created_at?: string | null
          enriched_at?: string | null
          enrichment_error?: string | null
          enrichment_status?: string | null
          id?: string
          name?: string
          platforms?: Json | null
          symbol?: string
          synced_at?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_chat_messages_session"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string | null
          id: string
          ip_hash: string | null
          last_seen: string | null
          session_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_hash?: string | null
          last_seen?: string | null
          session_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_hash?: string | null
          last_seen?: string | null
          session_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      chat_summaries: {
        Row: {
          last_addresses: Json | null
          last_assets: Json | null
          last_resolved_asset: string | null
          rolling_summary: string | null
          session_id: string
          updated_at: string | null
        }
        Insert: {
          last_addresses?: Json | null
          last_assets?: Json | null
          last_resolved_asset?: string | null
          rolling_summary?: string | null
          session_id: string
          updated_at?: string | null
        }
        Update: {
          last_addresses?: Json | null
          last_assets?: Json | null
          last_resolved_asset?: string | null
          rolling_summary?: string | null
          session_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_chat_summaries_session"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "chat_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      coingecko_assets: {
        Row: {
          asset_id: string
          categories: Json | null
          coingecko_id: string
          id: string
          last_synced: string | null
          market_cap_rank: number | null
        }
        Insert: {
          asset_id: string
          categories?: Json | null
          coingecko_id: string
          id?: string
          last_synced?: string | null
          market_cap_rank?: number | null
        }
        Update: {
          asset_id?: string
          categories?: Json | null
          coingecko_id?: string
          id?: string
          last_synced?: string | null
          market_cap_rank?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coingecko_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coingecko_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "ticker_mappings_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      company_details: {
        Row: {
          cik: string | null
          created_at: string | null
          description: string | null
          dividends: Json | null
          employees: number | null
          expires_at: string | null
          fetched_at: string | null
          headquarters: Json | null
          icon_url: string | null
          id: string
          industry: string | null
          last_financials: Json | null
          list_date: string | null
          logo_url: string | null
          market_cap: number | null
          name: string | null
          related_companies: Json | null
          sector: string | null
          sic_code: string | null
          sic_description: string | null
          splits: Json | null
          ticker: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          cik?: string | null
          created_at?: string | null
          description?: string | null
          dividends?: Json | null
          employees?: number | null
          expires_at?: string | null
          fetched_at?: string | null
          headquarters?: Json | null
          icon_url?: string | null
          id?: string
          industry?: string | null
          last_financials?: Json | null
          list_date?: string | null
          logo_url?: string | null
          market_cap?: number | null
          name?: string | null
          related_companies?: Json | null
          sector?: string | null
          sic_code?: string | null
          sic_description?: string | null
          splits?: Json | null
          ticker: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          cik?: string | null
          created_at?: string | null
          description?: string | null
          dividends?: Json | null
          employees?: number | null
          expires_at?: string | null
          fetched_at?: string | null
          headquarters?: Json | null
          icon_url?: string | null
          id?: string
          industry?: string | null
          last_financials?: Json | null
          list_date?: string | null
          logo_url?: string | null
          market_cap?: number | null
          name?: string | null
          related_companies?: Json | null
          sector?: string | null
          sic_code?: string | null
          sic_description?: string | null
          splits?: Json | null
          ticker?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      crypto_details: {
        Row: {
          categories: string[] | null
          coingecko_id: string | null
          community: Json | null
          description: string | null
          developer: Json | null
          expires_at: string | null
          image: Json | null
          links: Json | null
          market: Json | null
          name: string | null
          source: string | null
          supply: Json | null
          symbol: string
          updated_at: string | null
        }
        Insert: {
          categories?: string[] | null
          coingecko_id?: string | null
          community?: Json | null
          description?: string | null
          developer?: Json | null
          expires_at?: string | null
          image?: Json | null
          links?: Json | null
          market?: Json | null
          name?: string | null
          source?: string | null
          supply?: Json | null
          symbol: string
          updated_at?: string | null
        }
        Update: {
          categories?: string[] | null
          coingecko_id?: string | null
          community?: Json | null
          description?: string | null
          developer?: Json | null
          expires_at?: string | null
          image?: Json | null
          links?: Json | null
          market?: Json | null
          name?: string | null
          source?: string | null
          supply?: Json | null
          symbol?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      crypto_snapshot: {
        Row: {
          alt_rank: number | null
          blockchains: Json | null
          categories: Json | null
          change_24h: number | null
          change_percent: number | null
          coingecko_id: string | null
          galaxy_score: number | null
          high_24h: number | null
          interactions_24h: number | null
          logo_url: string | null
          low_24h: number | null
          lunarcrush_id: string | null
          market_cap: number | null
          market_cap_rank: number | null
          name: string
          open_24h: number | null
          percent_change_1h: number | null
          percent_change_7d: number | null
          price: number
          sentiment: number | null
          social_dominance: number | null
          social_volume_24h: number | null
          symbol: string
          ticker: string
          updated_at: string
          volume_24h: number | null
          vwap: number | null
        }
        Insert: {
          alt_rank?: number | null
          blockchains?: Json | null
          categories?: Json | null
          change_24h?: number | null
          change_percent?: number | null
          coingecko_id?: string | null
          galaxy_score?: number | null
          high_24h?: number | null
          interactions_24h?: number | null
          logo_url?: string | null
          low_24h?: number | null
          lunarcrush_id?: string | null
          market_cap?: number | null
          market_cap_rank?: number | null
          name: string
          open_24h?: number | null
          percent_change_1h?: number | null
          percent_change_7d?: number | null
          price?: number
          sentiment?: number | null
          social_dominance?: number | null
          social_volume_24h?: number | null
          symbol: string
          ticker: string
          updated_at?: string
          volume_24h?: number | null
          vwap?: number | null
        }
        Update: {
          alt_rank?: number | null
          blockchains?: Json | null
          categories?: Json | null
          change_24h?: number | null
          change_percent?: number | null
          coingecko_id?: string | null
          galaxy_score?: number | null
          high_24h?: number | null
          interactions_24h?: number | null
          logo_url?: string | null
          low_24h?: number | null
          lunarcrush_id?: string | null
          market_cap?: number | null
          market_cap_rank?: number | null
          name?: string
          open_24h?: number | null
          percent_change_1h?: number | null
          percent_change_7d?: number | null
          price?: number
          sentiment?: number | null
          social_dominance?: number | null
          social_volume_24h?: number | null
          symbol?: string
          ticker?: string
          updated_at?: string
          volume_24h?: number | null
          vwap?: number | null
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
      derivatives_cache: {
        Row: {
          funding_rate: number | null
          liquidations_24h: Json | null
          open_interest: number | null
          source: string | null
          symbol: string
          updated_at: string | null
        }
        Insert: {
          funding_rate?: number | null
          liquidations_24h?: Json | null
          open_interest?: number | null
          source?: string | null
          symbol: string
          updated_at?: string | null
        }
        Update: {
          funding_rate?: number | null
          liquidations_24h?: Json | null
          open_interest?: number | null
          source?: string | null
          symbol?: string
          updated_at?: string | null
        }
        Relationships: []
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
      exchange_ticker_data: {
        Row: {
          asset_symbol: string
          change_24h: number | null
          exchange: string
          high_24h: number | null
          id: string
          last_updated: string
          low_24h: number | null
          price: number | null
          timestamp: string
          updated_at: string | null
          volume_24h: number
        }
        Insert: {
          asset_symbol: string
          change_24h?: number | null
          exchange: string
          high_24h?: number | null
          id?: string
          last_updated?: string
          low_24h?: number | null
          price?: number | null
          timestamp?: string
          updated_at?: string | null
          volume_24h?: number
        }
        Update: {
          asset_symbol?: string
          change_24h?: number | null
          exchange?: string
          high_24h?: number | null
          id?: string
          last_updated?: string
          low_24h?: number | null
          price?: number | null
          timestamp?: string
          updated_at?: string | null
          volume_24h?: number
        }
        Relationships: []
      }
      forex_cards: {
        Row: {
          ask: number | null
          base_currency: string
          base_flag: string | null
          bid: number | null
          change_24h: number | null
          change_24h_pct: number | null
          created_at: string | null
          display_name: string | null
          high_24h: number | null
          id: string
          is_active: boolean | null
          is_major: boolean | null
          low_24h: number | null
          macd_line: number | null
          macd_signal: number | null
          open_24h: number | null
          pair: string
          price_updated_at: string | null
          quote_currency: string
          quote_flag: string | null
          rate: number | null
          rsi_14: number | null
          sma_20: number | null
          sma_200: number | null
          sma_50: number | null
          spread_pips: number | null
          technical_signal: string | null
          technicals_updated_at: string | null
          updated_at: string | null
        }
        Insert: {
          ask?: number | null
          base_currency: string
          base_flag?: string | null
          bid?: number | null
          change_24h?: number | null
          change_24h_pct?: number | null
          created_at?: string | null
          display_name?: string | null
          high_24h?: number | null
          id?: string
          is_active?: boolean | null
          is_major?: boolean | null
          low_24h?: number | null
          macd_line?: number | null
          macd_signal?: number | null
          open_24h?: number | null
          pair: string
          price_updated_at?: string | null
          quote_currency: string
          quote_flag?: string | null
          rate?: number | null
          rsi_14?: number | null
          sma_20?: number | null
          sma_200?: number | null
          sma_50?: number | null
          spread_pips?: number | null
          technical_signal?: string | null
          technicals_updated_at?: string | null
          updated_at?: string | null
        }
        Update: {
          ask?: number | null
          base_currency?: string
          base_flag?: string | null
          bid?: number | null
          change_24h?: number | null
          change_24h_pct?: number | null
          created_at?: string | null
          display_name?: string | null
          high_24h?: number | null
          id?: string
          is_active?: boolean | null
          is_major?: boolean | null
          low_24h?: number | null
          macd_line?: number | null
          macd_signal?: number | null
          open_24h?: number | null
          pair?: string
          price_updated_at?: string | null
          quote_currency?: string
          quote_flag?: string | null
          rate?: number | null
          rsi_14?: number | null
          sma_20?: number | null
          sma_200?: number | null
          sma_50?: number | null
          spread_pips?: number | null
          technical_signal?: string | null
          technicals_updated_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      live_prices: {
        Row: {
          asset_id: string | null
          change24h: number
          day_high: number | null
          day_low: number | null
          day_open: number | null
          display: string
          is_delayed: boolean | null
          last_trade_ts: string | null
          price: number
          source: string | null
          ticker: string
          updated_at: string
          volume: number | null
        }
        Insert: {
          asset_id?: string | null
          change24h: number
          day_high?: number | null
          day_low?: number | null
          day_open?: number | null
          display: string
          is_delayed?: boolean | null
          last_trade_ts?: string | null
          price: number
          source?: string | null
          ticker: string
          updated_at?: string
          volume?: number | null
        }
        Update: {
          asset_id?: string | null
          change24h?: number
          day_high?: number | null
          day_low?: number | null
          day_open?: number | null
          display?: string
          is_delayed?: boolean | null
          last_trade_ts?: string | null
          price?: number
          source?: string | null
          ticker?: string
          updated_at?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "live_prices_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_prices_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ticker_mappings_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      lunarcrush_assets: {
        Row: {
          alt_rank: number | null
          asset_id: string
          galaxy_score: number | null
          id: string
          last_synced: string | null
          lunarcrush_id: string | null
          social_volume: number | null
        }
        Insert: {
          alt_rank?: number | null
          asset_id: string
          galaxy_score?: number | null
          id?: string
          last_synced?: string | null
          lunarcrush_id?: string | null
          social_volume?: number | null
        }
        Update: {
          alt_rank?: number | null
          asset_id?: string
          galaxy_score?: number | null
          id?: string
          last_synced?: string | null
          lunarcrush_id?: string | null
          social_volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lunarcrush_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lunarcrush_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "ticker_mappings_v2"
            referencedColumns: ["id"]
          },
        ]
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
          word_count: number | null
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
          word_count?: number | null
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
          word_count?: number | null
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
      news_cache: {
        Row: {
          created_at: string | null
          id: string
          published_at: string | null
          source: string | null
          summary: string | null
          symbol: string
          title: string
          url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          published_at?: string | null
          source?: string | null
          summary?: string | null
          symbol: string
          title: string
          url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          published_at?: string | null
          source?: string | null
          summary?: string | null
          symbol?: string
          title?: string
          url?: string | null
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
      polygon_assets: {
        Row: {
          asset_id: string
          id: string
          is_active: boolean | null
          last_synced: string | null
          market: string
          polygon_ticker: string
        }
        Insert: {
          asset_id: string
          id?: string
          is_active?: boolean | null
          last_synced?: string | null
          market: string
          polygon_ticker: string
        }
        Update: {
          asset_id?: string
          id?: string
          is_active?: boolean | null
          last_synced?: string | null
          market?: string
          polygon_ticker?: string
        }
        Relationships: [
          {
            foreignKeyName: "polygon_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polygon_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "ticker_mappings_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      polygon_crypto_cards: {
        Row: {
          ask_price: number | null
          bid_price: number | null
          canonical_symbol: string
          change_24h_pct: number | null
          close_24h: number | null
          created_at: string | null
          ema_12: number | null
          ema_26: number | null
          high_24h: number | null
          id: string
          in_reference: boolean | null
          in_snapshot: boolean | null
          is_active: boolean | null
          last_trade_at: string | null
          low_24h: number | null
          macd: number | null
          macd_histogram: number | null
          macd_signal: number | null
          name: string | null
          open_24h: number | null
          polygon_tickers: string[] | null
          price_source_ticker: string | null
          price_updated_at: string | null
          price_usd: number | null
          primary_ticker: string | null
          reference_synced_at: string | null
          rsi_14: number | null
          sma_20: number | null
          sma_200: number | null
          sma_50: number | null
          spread_pct: number | null
          technicals_updated_at: string | null
          updated_at: string | null
          volume_24h: number | null
          vwap_24h: number | null
        }
        Insert: {
          ask_price?: number | null
          bid_price?: number | null
          canonical_symbol: string
          change_24h_pct?: number | null
          close_24h?: number | null
          created_at?: string | null
          ema_12?: number | null
          ema_26?: number | null
          high_24h?: number | null
          id?: string
          in_reference?: boolean | null
          in_snapshot?: boolean | null
          is_active?: boolean | null
          last_trade_at?: string | null
          low_24h?: number | null
          macd?: number | null
          macd_histogram?: number | null
          macd_signal?: number | null
          name?: string | null
          open_24h?: number | null
          polygon_tickers?: string[] | null
          price_source_ticker?: string | null
          price_updated_at?: string | null
          price_usd?: number | null
          primary_ticker?: string | null
          reference_synced_at?: string | null
          rsi_14?: number | null
          sma_20?: number | null
          sma_200?: number | null
          sma_50?: number | null
          spread_pct?: number | null
          technicals_updated_at?: string | null
          updated_at?: string | null
          volume_24h?: number | null
          vwap_24h?: number | null
        }
        Update: {
          ask_price?: number | null
          bid_price?: number | null
          canonical_symbol?: string
          change_24h_pct?: number | null
          close_24h?: number | null
          created_at?: string | null
          ema_12?: number | null
          ema_26?: number | null
          high_24h?: number | null
          id?: string
          in_reference?: boolean | null
          in_snapshot?: boolean | null
          is_active?: boolean | null
          last_trade_at?: string | null
          low_24h?: number | null
          macd?: number | null
          macd_histogram?: number | null
          macd_signal?: number | null
          name?: string | null
          open_24h?: number | null
          polygon_tickers?: string[] | null
          price_source_ticker?: string | null
          price_updated_at?: string | null
          price_usd?: number | null
          primary_ticker?: string | null
          reference_synced_at?: string | null
          rsi_14?: number | null
          sma_20?: number | null
          sma_200?: number | null
          sma_50?: number | null
          spread_pct?: number | null
          technicals_updated_at?: string | null
          updated_at?: string | null
          volume_24h?: number | null
          vwap_24h?: number | null
        }
        Relationships: []
      }
      price_cache: {
        Row: {
          cached_at: string
          expires_at: string
          id: string
          metadata: Json | null
          price: number
          source: string
          symbol: string
        }
        Insert: {
          cached_at?: string
          expires_at?: string
          id?: string
          metadata?: Json | null
          price: number
          source: string
          symbol: string
        }
        Update: {
          cached_at?: string
          expires_at?: string
          id?: string
          metadata?: Json | null
          price?: number
          source?: string
          symbol?: string
        }
        Relationships: []
      }
      price_history: {
        Row: {
          asset_type: string
          close: number
          created_at: string
          high: number
          low: number
          open: number
          ticker: string
          timeframe: string
          timestamp: string
          updated_at: string
          volume: number
        }
        Insert: {
          asset_type: string
          close: number
          created_at?: string
          high: number
          low: number
          open: number
          ticker: string
          timeframe: string
          timestamp: string
          updated_at?: string
          volume: number
        }
        Update: {
          asset_type?: string
          close?: number
          created_at?: string
          high?: number
          low?: number
          open?: number
          ticker?: string
          timeframe?: string
          timestamp?: string
          updated_at?: string
          volume?: number
        }
        Relationships: []
      }
      price_sync_leader: {
        Row: {
          heartbeat_at: string
          id: string
          instance_id: string
        }
        Insert: {
          heartbeat_at?: string
          id?: string
          instance_id: string
        }
        Update: {
          heartbeat_at?: string
          id?: string
          instance_id?: string
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
      quote_population_history: {
        Row: {
          categories_processed: Json | null
          duplicates_skipped: number | null
          duration_ms: number | null
          errors: Json | null
          id: string
          quotes_fetched: number | null
          quotes_inserted: number | null
          success: boolean | null
          triggered_at: string
          triggered_by: string
        }
        Insert: {
          categories_processed?: Json | null
          duplicates_skipped?: number | null
          duration_ms?: number | null
          errors?: Json | null
          id?: string
          quotes_fetched?: number | null
          quotes_inserted?: number | null
          success?: boolean | null
          triggered_at?: string
          triggered_by: string
        }
        Update: {
          categories_processed?: Json | null
          duplicates_skipped?: number | null
          duration_ms?: number | null
          errors?: Json | null
          id?: string
          quotes_fetched?: number | null
          quotes_inserted?: number | null
          success?: boolean | null
          triggered_at?: string
          triggered_by?: string
        }
        Relationships: []
      }
      security_cache: {
        Row: {
          address: string
          chain: string | null
          contract_info: Json | null
          flags: Json | null
          is_honeypot: boolean | null
          liquidity: Json | null
          risk_level: string | null
          source: string | null
          updated_at: string | null
        }
        Insert: {
          address: string
          chain?: string | null
          contract_info?: Json | null
          flags?: Json | null
          is_honeypot?: boolean | null
          liquidity?: Json | null
          risk_level?: string | null
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          chain?: string | null
          contract_info?: Json | null
          flags?: Json | null
          is_honeypot?: boolean | null
          liquidity?: Json | null
          risk_level?: string | null
          source?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
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
      social_sentiment_cache: {
        Row: {
          created_at: string
          data: Json
          generated_at: string
          id: string
          is_active: boolean
          received_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          generated_at: string
          id?: string
          is_active?: boolean
          received_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          generated_at?: string
          id?: string
          is_active?: boolean
          received_at?: string
        }
        Relationships: []
      }
      stock_cards: {
        Row: {
          ai_summary: string | null
          ai_updated_at: string | null
          avg_volume: number | null
          change_pct: number | null
          change_usd: number | null
          close_price: number | null
          contributors_active: number | null
          country: string | null
          created_at: string | null
          dividend_yield: number | null
          eps: number | null
          exchange: string | null
          fifty_two_week_high: number | null
          fifty_two_week_low: number | null
          galaxy_score: number | null
          high_price: number | null
          id: string
          industry: string | null
          interactions_24h: number | null
          is_active: boolean | null
          is_delayed: boolean | null
          logo_url: string | null
          low_price: number | null
          macd_line: number | null
          macd_signal: number | null
          market_cap: number | null
          name: string | null
          news_volume: number | null
          open_price: number | null
          pe_ratio: number | null
          previous_close: number | null
          price_updated_at: string | null
          price_usd: number | null
          reddit_volume: number | null
          rsi_14: number | null
          sector: string | null
          sentiment: number | null
          sma_20: number | null
          sma_200: number | null
          sma_50: number | null
          social_dominance: number | null
          social_updated_at: string | null
          social_volume_24h: number | null
          symbol: string
          technical_signal: string | null
          technicals_updated_at: string | null
          tier: number | null
          top_news: Json | null
          top_posts: Json | null
          twitter_volume: number | null
          updated_at: string | null
          volume: number | null
        }
        Insert: {
          ai_summary?: string | null
          ai_updated_at?: string | null
          avg_volume?: number | null
          change_pct?: number | null
          change_usd?: number | null
          close_price?: number | null
          contributors_active?: number | null
          country?: string | null
          created_at?: string | null
          dividend_yield?: number | null
          eps?: number | null
          exchange?: string | null
          fifty_two_week_high?: number | null
          fifty_two_week_low?: number | null
          galaxy_score?: number | null
          high_price?: number | null
          id?: string
          industry?: string | null
          interactions_24h?: number | null
          is_active?: boolean | null
          is_delayed?: boolean | null
          logo_url?: string | null
          low_price?: number | null
          macd_line?: number | null
          macd_signal?: number | null
          market_cap?: number | null
          name?: string | null
          news_volume?: number | null
          open_price?: number | null
          pe_ratio?: number | null
          previous_close?: number | null
          price_updated_at?: string | null
          price_usd?: number | null
          reddit_volume?: number | null
          rsi_14?: number | null
          sector?: string | null
          sentiment?: number | null
          sma_20?: number | null
          sma_200?: number | null
          sma_50?: number | null
          social_dominance?: number | null
          social_updated_at?: string | null
          social_volume_24h?: number | null
          symbol: string
          technical_signal?: string | null
          technicals_updated_at?: string | null
          tier?: number | null
          top_news?: Json | null
          top_posts?: Json | null
          twitter_volume?: number | null
          updated_at?: string | null
          volume?: number | null
        }
        Update: {
          ai_summary?: string | null
          ai_updated_at?: string | null
          avg_volume?: number | null
          change_pct?: number | null
          change_usd?: number | null
          close_price?: number | null
          contributors_active?: number | null
          country?: string | null
          created_at?: string | null
          dividend_yield?: number | null
          eps?: number | null
          exchange?: string | null
          fifty_two_week_high?: number | null
          fifty_two_week_low?: number | null
          galaxy_score?: number | null
          high_price?: number | null
          id?: string
          industry?: string | null
          interactions_24h?: number | null
          is_active?: boolean | null
          is_delayed?: boolean | null
          logo_url?: string | null
          low_price?: number | null
          macd_line?: number | null
          macd_signal?: number | null
          market_cap?: number | null
          name?: string | null
          news_volume?: number | null
          open_price?: number | null
          pe_ratio?: number | null
          previous_close?: number | null
          price_updated_at?: string | null
          price_usd?: number | null
          reddit_volume?: number | null
          rsi_14?: number | null
          sector?: string | null
          sentiment?: number | null
          sma_20?: number | null
          sma_200?: number | null
          sma_50?: number | null
          social_dominance?: number | null
          social_updated_at?: string | null
          social_volume_24h?: number | null
          symbol?: string
          technical_signal?: string | null
          technicals_updated_at?: string | null
          tier?: number | null
          top_news?: Json | null
          top_posts?: Json | null
          twitter_volume?: number | null
          updated_at?: string | null
          volume?: number | null
        }
        Relationships: []
      }
      stock_snapshot: {
        Row: {
          asset_id: string | null
          change_24h: number | null
          change_percent: number | null
          high_24h: number | null
          industry: string | null
          logo_url: string | null
          low_24h: number | null
          market_cap: number | null
          name: string
          open_price: number | null
          prev_close: number | null
          price: number
          sector: string | null
          symbol: string
          ticker: string
          updated_at: string
          volume_24h: number | null
          vwap: number | null
        }
        Insert: {
          asset_id?: string | null
          change_24h?: number | null
          change_percent?: number | null
          high_24h?: number | null
          industry?: string | null
          logo_url?: string | null
          low_24h?: number | null
          market_cap?: number | null
          name: string
          open_price?: number | null
          prev_close?: number | null
          price?: number
          sector?: string | null
          symbol: string
          ticker: string
          updated_at?: string
          volume_24h?: number | null
          vwap?: number | null
        }
        Update: {
          asset_id?: string | null
          change_24h?: number | null
          change_percent?: number | null
          high_24h?: number | null
          industry?: string | null
          logo_url?: string | null
          low_24h?: number | null
          market_cap?: number | null
          name?: string
          open_price?: number | null
          prev_close?: number | null
          price?: number
          sector?: string | null
          symbol?: string
          ticker?: string
          updated_at?: string
          volume_24h?: number | null
          vwap?: number | null
        }
        Relationships: []
      }
      technical_indicators: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          indicator_type: string
          ticker: string
          timeframe: string
          timestamp: string
          value: Json
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          indicator_type: string
          ticker: string
          timeframe?: string
          timestamp: string
          value: Json
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          indicator_type?: string
          ticker?: string
          timeframe?: string
          timestamp?: string
          value?: Json
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
          dex_platforms: Json | null
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
          dex_platforms?: Json | null
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
          dex_platforms?: Json | null
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
      token_cards: {
        Row: {
          adx: number | null
          adx_signal: string | null
          ai_summary: string | null
          ai_summary_short: string | null
          ai_updated_at: string | null
          alt_rank: number | null
          alt_rank_change_24h: number | null
          ask_price: number | null
          ask_size: number | null
          ath_change_pct: number | null
          ath_date: string | null
          ath_price: number | null
          atl_change_pct: number | null
          atl_date: string | null
          atl_price: number | null
          bid_price: number | null
          bid_size: number | null
          bollinger_lower: number | null
          bollinger_middle: number | null
          bollinger_position: string | null
          bollinger_upper: number | null
          buy_sell_label: string | null
          buy_sell_ratio: number | null
          buy_tax: number | null
          buy_tax_label: string | null
          can_take_back_ownership: boolean | null
          cannot_buy: boolean | null
          cannot_sell_all: boolean | null
          canonical_symbol: string
          categories: string[] | null
          change_1h_pct: number | null
          change_1h_usd: number | null
          change_24h_pct: number | null
          change_24h_usd: number | null
          change_30d_pct: number | null
          change_30d_usd: number | null
          change_7d_pct: number | null
          change_7d_usd: number | null
          circulating_supply: number | null
          close_24h: number | null
          coingecko_id: string | null
          contracts: Json | null
          contributors_active: number | null
          contributors_change_24h_pct: number | null
          correlation_rank: number | null
          created_at: string | null
          creator_address: string | null
          creators_updated_at: string | null
          description: string | null
          dex_buyers_24h: number | null
          dex_buys_24h: number | null
          dex_pairs: Json | null
          dex_pairs_count: number | null
          dex_sellers_24h: number | null
          dex_sells_24h: number | null
          dex_volume_1h: number | null
          dex_volume_24h: number | null
          dex_volume_6h: number | null
          discord: string | null
          discord_url: string | null
          ema_12: number | null
          ema_200: number | null
          ema_26: number | null
          ema_50: number | null
          explorers: Json | null
          external_call: boolean | null
          first_seen_at: string | null
          fully_diluted_valuation: number | null
          galaxy_score: number | null
          galaxy_score_change_24h: number | null
          github: string | null
          github_url: string | null
          hidden_owner: boolean | null
          high_24h: number | null
          holder_count: number | null
          honeypot_reason: string | null
          honeypot_with_same_creator: boolean | null
          id: string
          identity_updated_at: string | null
          interactions_24h: number | null
          interactions_change_24h_pct: number | null
          is_active: boolean | null
          is_anti_whale: boolean | null
          is_blacklisted: boolean | null
          is_honeypot: boolean | null
          is_lp_locked: boolean | null
          is_mintable: boolean | null
          is_open_source: boolean | null
          is_ownership_renounced: boolean | null
          is_proxy: boolean | null
          is_scam: boolean | null
          is_trending: boolean | null
          is_verified: boolean | null
          is_whitelisted: boolean | null
          key_themes: string[] | null
          large_trades_24h: Json | null
          large_trades_count: number | null
          liquidity_change_24h_pct: number | null
          liquidity_updated_at: string | null
          logo_url: string | null
          low_24h: number | null
          lp_holder_count: number | null
          lp_holders: Json | null
          lp_lock_until: string | null
          lp_total_supply: number | null
          lunarcrush_id: number | null
          macd_histogram: number | null
          macd_line: number | null
          macd_signal: number | null
          macd_trend: string | null
          manual_flags: string[] | null
          manual_notes: string | null
          market_cap: number | null
          market_cap_rank: number | null
          market_dominance: number | null
          max_supply: number | null
          name: string | null
          news_sentiment: number | null
          news_updated_at: string | null
          news_volume_24h: number | null
          notable_events: string[] | null
          oldest_pair_created_at: string | null
          open_24h: number | null
          owner_address: string | null
          owner_can_change_balance: boolean | null
          pair_age_days: number | null
          polygon_ticker: string | null
          posts_updated_at: string | null
          price_btc: number | null
          price_eth: number | null
          price_source: string | null
          price_updated_at: string | null
          price_usd: number | null
          price_vs_sma_20: string | null
          price_vs_sma_200: string | null
          price_vs_sma_50: string | null
          primary_chain: string | null
          primary_dex: string | null
          primary_dex_pair: string | null
          recent_trades: Json | null
          reddit: string | null
          reddit_contributors: number | null
          reddit_interactions: number | null
          reddit_sentiment: number | null
          reddit_url: string | null
          reddit_volume_24h: number | null
          rsi_14: number | null
          rsi_signal: string | null
          security_chain: string | null
          security_flags: string[] | null
          security_grade: string | null
          security_risks_critical: number | null
          security_risks_high: number | null
          security_risks_low: number | null
          security_risks_medium: number | null
          security_score: number | null
          security_updated_at: string | null
          self_destruct: boolean | null
          sell_tax: number | null
          sell_tax_label: string | null
          sentiment: number | null
          sentiment_label: string | null
          slippage_modifiable: boolean | null
          slug: string | null
          sma_100: number | null
          sma_20: number | null
          sma_200: number | null
          sma_50: number | null
          social_dominance: number | null
          social_updated_at: string | null
          social_volume_24h: number | null
          social_volume_change_24h_pct: number | null
          spam_score: number | null
          spread_pct: number | null
          spread_usd: number | null
          stoch_d: number | null
          stoch_k: number | null
          stoch_signal: string | null
          tags: string[] | null
          technical_score: number | null
          technical_signal: string | null
          technicals_updated_at: string | null
          telegram: string | null
          telegram_sentiment: number | null
          telegram_url: string | null
          telegram_volume_24h: number | null
          tier: number | null
          tier_reason: string | null
          tiktok_contributors: number | null
          tiktok_interactions: number | null
          tiktok_sentiment: number | null
          tiktok_volume_24h: number | null
          top_creators: Json | null
          top_creators_count: number | null
          top_news: Json | null
          top_news_count: number | null
          top_posts: Json | null
          top_posts_count: number | null
          top10_holder_percent: number | null
          top10_holders: Json | null
          total_liquidity_usd: number | null
          total_supply: number | null
          trade_count_24h: number | null
          trades_updated_at: string | null
          trading_cooldown: boolean | null
          transfer_pausable: boolean | null
          twitter: string | null
          twitter_contributors: number | null
          twitter_interactions: number | null
          twitter_sentiment: number | null
          twitter_url: string | null
          twitter_volume_24h: number | null
          updated_at: string | null
          volume_24h_native: number | null
          volume_24h_usd: number | null
          vwap_24h: number | null
          website: string | null
          whitepaper_url: string | null
          youtube_contributors: number | null
          youtube_interactions: number | null
          youtube_sentiment: number | null
          youtube_volume_24h: number | null
          zombiedog_analysis: string | null
          zombiedog_signal: string | null
          zombiedog_updated_at: string | null
        }
        Insert: {
          adx?: number | null
          adx_signal?: string | null
          ai_summary?: string | null
          ai_summary_short?: string | null
          ai_updated_at?: string | null
          alt_rank?: number | null
          alt_rank_change_24h?: number | null
          ask_price?: number | null
          ask_size?: number | null
          ath_change_pct?: number | null
          ath_date?: string | null
          ath_price?: number | null
          atl_change_pct?: number | null
          atl_date?: string | null
          atl_price?: number | null
          bid_price?: number | null
          bid_size?: number | null
          bollinger_lower?: number | null
          bollinger_middle?: number | null
          bollinger_position?: string | null
          bollinger_upper?: number | null
          buy_sell_label?: string | null
          buy_sell_ratio?: number | null
          buy_tax?: number | null
          buy_tax_label?: string | null
          can_take_back_ownership?: boolean | null
          cannot_buy?: boolean | null
          cannot_sell_all?: boolean | null
          canonical_symbol: string
          categories?: string[] | null
          change_1h_pct?: number | null
          change_1h_usd?: number | null
          change_24h_pct?: number | null
          change_24h_usd?: number | null
          change_30d_pct?: number | null
          change_30d_usd?: number | null
          change_7d_pct?: number | null
          change_7d_usd?: number | null
          circulating_supply?: number | null
          close_24h?: number | null
          coingecko_id?: string | null
          contracts?: Json | null
          contributors_active?: number | null
          contributors_change_24h_pct?: number | null
          correlation_rank?: number | null
          created_at?: string | null
          creator_address?: string | null
          creators_updated_at?: string | null
          description?: string | null
          dex_buyers_24h?: number | null
          dex_buys_24h?: number | null
          dex_pairs?: Json | null
          dex_pairs_count?: number | null
          dex_sellers_24h?: number | null
          dex_sells_24h?: number | null
          dex_volume_1h?: number | null
          dex_volume_24h?: number | null
          dex_volume_6h?: number | null
          discord?: string | null
          discord_url?: string | null
          ema_12?: number | null
          ema_200?: number | null
          ema_26?: number | null
          ema_50?: number | null
          explorers?: Json | null
          external_call?: boolean | null
          first_seen_at?: string | null
          fully_diluted_valuation?: number | null
          galaxy_score?: number | null
          galaxy_score_change_24h?: number | null
          github?: string | null
          github_url?: string | null
          hidden_owner?: boolean | null
          high_24h?: number | null
          holder_count?: number | null
          honeypot_reason?: string | null
          honeypot_with_same_creator?: boolean | null
          id?: string
          identity_updated_at?: string | null
          interactions_24h?: number | null
          interactions_change_24h_pct?: number | null
          is_active?: boolean | null
          is_anti_whale?: boolean | null
          is_blacklisted?: boolean | null
          is_honeypot?: boolean | null
          is_lp_locked?: boolean | null
          is_mintable?: boolean | null
          is_open_source?: boolean | null
          is_ownership_renounced?: boolean | null
          is_proxy?: boolean | null
          is_scam?: boolean | null
          is_trending?: boolean | null
          is_verified?: boolean | null
          is_whitelisted?: boolean | null
          key_themes?: string[] | null
          large_trades_24h?: Json | null
          large_trades_count?: number | null
          liquidity_change_24h_pct?: number | null
          liquidity_updated_at?: string | null
          logo_url?: string | null
          low_24h?: number | null
          lp_holder_count?: number | null
          lp_holders?: Json | null
          lp_lock_until?: string | null
          lp_total_supply?: number | null
          lunarcrush_id?: number | null
          macd_histogram?: number | null
          macd_line?: number | null
          macd_signal?: number | null
          macd_trend?: string | null
          manual_flags?: string[] | null
          manual_notes?: string | null
          market_cap?: number | null
          market_cap_rank?: number | null
          market_dominance?: number | null
          max_supply?: number | null
          name?: string | null
          news_sentiment?: number | null
          news_updated_at?: string | null
          news_volume_24h?: number | null
          notable_events?: string[] | null
          oldest_pair_created_at?: string | null
          open_24h?: number | null
          owner_address?: string | null
          owner_can_change_balance?: boolean | null
          pair_age_days?: number | null
          polygon_ticker?: string | null
          posts_updated_at?: string | null
          price_btc?: number | null
          price_eth?: number | null
          price_source?: string | null
          price_updated_at?: string | null
          price_usd?: number | null
          price_vs_sma_20?: string | null
          price_vs_sma_200?: string | null
          price_vs_sma_50?: string | null
          primary_chain?: string | null
          primary_dex?: string | null
          primary_dex_pair?: string | null
          recent_trades?: Json | null
          reddit?: string | null
          reddit_contributors?: number | null
          reddit_interactions?: number | null
          reddit_sentiment?: number | null
          reddit_url?: string | null
          reddit_volume_24h?: number | null
          rsi_14?: number | null
          rsi_signal?: string | null
          security_chain?: string | null
          security_flags?: string[] | null
          security_grade?: string | null
          security_risks_critical?: number | null
          security_risks_high?: number | null
          security_risks_low?: number | null
          security_risks_medium?: number | null
          security_score?: number | null
          security_updated_at?: string | null
          self_destruct?: boolean | null
          sell_tax?: number | null
          sell_tax_label?: string | null
          sentiment?: number | null
          sentiment_label?: string | null
          slippage_modifiable?: boolean | null
          slug?: string | null
          sma_100?: number | null
          sma_20?: number | null
          sma_200?: number | null
          sma_50?: number | null
          social_dominance?: number | null
          social_updated_at?: string | null
          social_volume_24h?: number | null
          social_volume_change_24h_pct?: number | null
          spam_score?: number | null
          spread_pct?: number | null
          spread_usd?: number | null
          stoch_d?: number | null
          stoch_k?: number | null
          stoch_signal?: string | null
          tags?: string[] | null
          technical_score?: number | null
          technical_signal?: string | null
          technicals_updated_at?: string | null
          telegram?: string | null
          telegram_sentiment?: number | null
          telegram_url?: string | null
          telegram_volume_24h?: number | null
          tier?: number | null
          tier_reason?: string | null
          tiktok_contributors?: number | null
          tiktok_interactions?: number | null
          tiktok_sentiment?: number | null
          tiktok_volume_24h?: number | null
          top_creators?: Json | null
          top_creators_count?: number | null
          top_news?: Json | null
          top_news_count?: number | null
          top_posts?: Json | null
          top_posts_count?: number | null
          top10_holder_percent?: number | null
          top10_holders?: Json | null
          total_liquidity_usd?: number | null
          total_supply?: number | null
          trade_count_24h?: number | null
          trades_updated_at?: string | null
          trading_cooldown?: boolean | null
          transfer_pausable?: boolean | null
          twitter?: string | null
          twitter_contributors?: number | null
          twitter_interactions?: number | null
          twitter_sentiment?: number | null
          twitter_url?: string | null
          twitter_volume_24h?: number | null
          updated_at?: string | null
          volume_24h_native?: number | null
          volume_24h_usd?: number | null
          vwap_24h?: number | null
          website?: string | null
          whitepaper_url?: string | null
          youtube_contributors?: number | null
          youtube_interactions?: number | null
          youtube_sentiment?: number | null
          youtube_volume_24h?: number | null
          zombiedog_analysis?: string | null
          zombiedog_signal?: string | null
          zombiedog_updated_at?: string | null
        }
        Update: {
          adx?: number | null
          adx_signal?: string | null
          ai_summary?: string | null
          ai_summary_short?: string | null
          ai_updated_at?: string | null
          alt_rank?: number | null
          alt_rank_change_24h?: number | null
          ask_price?: number | null
          ask_size?: number | null
          ath_change_pct?: number | null
          ath_date?: string | null
          ath_price?: number | null
          atl_change_pct?: number | null
          atl_date?: string | null
          atl_price?: number | null
          bid_price?: number | null
          bid_size?: number | null
          bollinger_lower?: number | null
          bollinger_middle?: number | null
          bollinger_position?: string | null
          bollinger_upper?: number | null
          buy_sell_label?: string | null
          buy_sell_ratio?: number | null
          buy_tax?: number | null
          buy_tax_label?: string | null
          can_take_back_ownership?: boolean | null
          cannot_buy?: boolean | null
          cannot_sell_all?: boolean | null
          canonical_symbol?: string
          categories?: string[] | null
          change_1h_pct?: number | null
          change_1h_usd?: number | null
          change_24h_pct?: number | null
          change_24h_usd?: number | null
          change_30d_pct?: number | null
          change_30d_usd?: number | null
          change_7d_pct?: number | null
          change_7d_usd?: number | null
          circulating_supply?: number | null
          close_24h?: number | null
          coingecko_id?: string | null
          contracts?: Json | null
          contributors_active?: number | null
          contributors_change_24h_pct?: number | null
          correlation_rank?: number | null
          created_at?: string | null
          creator_address?: string | null
          creators_updated_at?: string | null
          description?: string | null
          dex_buyers_24h?: number | null
          dex_buys_24h?: number | null
          dex_pairs?: Json | null
          dex_pairs_count?: number | null
          dex_sellers_24h?: number | null
          dex_sells_24h?: number | null
          dex_volume_1h?: number | null
          dex_volume_24h?: number | null
          dex_volume_6h?: number | null
          discord?: string | null
          discord_url?: string | null
          ema_12?: number | null
          ema_200?: number | null
          ema_26?: number | null
          ema_50?: number | null
          explorers?: Json | null
          external_call?: boolean | null
          first_seen_at?: string | null
          fully_diluted_valuation?: number | null
          galaxy_score?: number | null
          galaxy_score_change_24h?: number | null
          github?: string | null
          github_url?: string | null
          hidden_owner?: boolean | null
          high_24h?: number | null
          holder_count?: number | null
          honeypot_reason?: string | null
          honeypot_with_same_creator?: boolean | null
          id?: string
          identity_updated_at?: string | null
          interactions_24h?: number | null
          interactions_change_24h_pct?: number | null
          is_active?: boolean | null
          is_anti_whale?: boolean | null
          is_blacklisted?: boolean | null
          is_honeypot?: boolean | null
          is_lp_locked?: boolean | null
          is_mintable?: boolean | null
          is_open_source?: boolean | null
          is_ownership_renounced?: boolean | null
          is_proxy?: boolean | null
          is_scam?: boolean | null
          is_trending?: boolean | null
          is_verified?: boolean | null
          is_whitelisted?: boolean | null
          key_themes?: string[] | null
          large_trades_24h?: Json | null
          large_trades_count?: number | null
          liquidity_change_24h_pct?: number | null
          liquidity_updated_at?: string | null
          logo_url?: string | null
          low_24h?: number | null
          lp_holder_count?: number | null
          lp_holders?: Json | null
          lp_lock_until?: string | null
          lp_total_supply?: number | null
          lunarcrush_id?: number | null
          macd_histogram?: number | null
          macd_line?: number | null
          macd_signal?: number | null
          macd_trend?: string | null
          manual_flags?: string[] | null
          manual_notes?: string | null
          market_cap?: number | null
          market_cap_rank?: number | null
          market_dominance?: number | null
          max_supply?: number | null
          name?: string | null
          news_sentiment?: number | null
          news_updated_at?: string | null
          news_volume_24h?: number | null
          notable_events?: string[] | null
          oldest_pair_created_at?: string | null
          open_24h?: number | null
          owner_address?: string | null
          owner_can_change_balance?: boolean | null
          pair_age_days?: number | null
          polygon_ticker?: string | null
          posts_updated_at?: string | null
          price_btc?: number | null
          price_eth?: number | null
          price_source?: string | null
          price_updated_at?: string | null
          price_usd?: number | null
          price_vs_sma_20?: string | null
          price_vs_sma_200?: string | null
          price_vs_sma_50?: string | null
          primary_chain?: string | null
          primary_dex?: string | null
          primary_dex_pair?: string | null
          recent_trades?: Json | null
          reddit?: string | null
          reddit_contributors?: number | null
          reddit_interactions?: number | null
          reddit_sentiment?: number | null
          reddit_url?: string | null
          reddit_volume_24h?: number | null
          rsi_14?: number | null
          rsi_signal?: string | null
          security_chain?: string | null
          security_flags?: string[] | null
          security_grade?: string | null
          security_risks_critical?: number | null
          security_risks_high?: number | null
          security_risks_low?: number | null
          security_risks_medium?: number | null
          security_score?: number | null
          security_updated_at?: string | null
          self_destruct?: boolean | null
          sell_tax?: number | null
          sell_tax_label?: string | null
          sentiment?: number | null
          sentiment_label?: string | null
          slippage_modifiable?: boolean | null
          slug?: string | null
          sma_100?: number | null
          sma_20?: number | null
          sma_200?: number | null
          sma_50?: number | null
          social_dominance?: number | null
          social_updated_at?: string | null
          social_volume_24h?: number | null
          social_volume_change_24h_pct?: number | null
          spam_score?: number | null
          spread_pct?: number | null
          spread_usd?: number | null
          stoch_d?: number | null
          stoch_k?: number | null
          stoch_signal?: string | null
          tags?: string[] | null
          technical_score?: number | null
          technical_signal?: string | null
          technicals_updated_at?: string | null
          telegram?: string | null
          telegram_sentiment?: number | null
          telegram_url?: string | null
          telegram_volume_24h?: number | null
          tier?: number | null
          tier_reason?: string | null
          tiktok_contributors?: number | null
          tiktok_interactions?: number | null
          tiktok_sentiment?: number | null
          tiktok_volume_24h?: number | null
          top_creators?: Json | null
          top_creators_count?: number | null
          top_news?: Json | null
          top_news_count?: number | null
          top_posts?: Json | null
          top_posts_count?: number | null
          top10_holder_percent?: number | null
          top10_holders?: Json | null
          total_liquidity_usd?: number | null
          total_supply?: number | null
          trade_count_24h?: number | null
          trades_updated_at?: string | null
          trading_cooldown?: boolean | null
          transfer_pausable?: boolean | null
          twitter?: string | null
          twitter_contributors?: number | null
          twitter_interactions?: number | null
          twitter_sentiment?: number | null
          twitter_url?: string | null
          twitter_volume_24h?: number | null
          updated_at?: string | null
          volume_24h_native?: number | null
          volume_24h_usd?: number | null
          vwap_24h?: number | null
          website?: string | null
          whitepaper_url?: string | null
          youtube_contributors?: number | null
          youtube_interactions?: number | null
          youtube_sentiment?: number | null
          youtube_volume_24h?: number | null
          zombiedog_analysis?: string | null
          zombiedog_signal?: string | null
          zombiedog_updated_at?: string | null
        }
        Relationships: []
      }
      token_contracts: {
        Row: {
          asset_id: string
          chain: string
          contract_address: string
          created_at: string | null
          decimals: number | null
          id: string
          is_primary: boolean | null
        }
        Insert: {
          asset_id: string
          chain: string
          contract_address: string
          created_at?: string | null
          decimals?: number | null
          id?: string
          is_primary?: boolean | null
        }
        Update: {
          asset_id?: string
          chain?: string
          contract_address?: string
          created_at?: string | null
          decimals?: number | null
          id?: string
          is_primary?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "token_contracts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_contracts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ticker_mappings_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      token_price_history: {
        Row: {
          close: number
          created_at: string | null
          high: number
          id: number
          low: number
          open: number
          timeframe: string
          timestamp: string
          token_symbol: string
          trade_count: number | null
          volume: number | null
          vwap: number | null
        }
        Insert: {
          close: number
          created_at?: string | null
          high: number
          id?: number
          low: number
          open: number
          timeframe: string
          timestamp: string
          token_symbol: string
          trade_count?: number | null
          volume?: number | null
          vwap?: number | null
        }
        Update: {
          close?: number
          created_at?: string | null
          high?: number
          id?: number
          low?: number
          open?: number
          timeframe?: string
          timestamp?: string
          token_symbol?: string
          trade_count?: number | null
          volume?: number | null
          vwap?: number | null
        }
        Relationships: []
      }
      token_social_history: {
        Row: {
          alt_rank: number | null
          contributors: number | null
          created_at: string | null
          galaxy_score: number | null
          id: number
          interactions: number | null
          price_usd: number | null
          sentiment: number | null
          social_volume: number | null
          timeframe: string
          timestamp: string
          token_symbol: string
        }
        Insert: {
          alt_rank?: number | null
          contributors?: number | null
          created_at?: string | null
          galaxy_score?: number | null
          id?: number
          interactions?: number | null
          price_usd?: number | null
          sentiment?: number | null
          social_volume?: number | null
          timeframe: string
          timestamp: string
          token_symbol: string
        }
        Update: {
          alt_rank?: number | null
          contributors?: number | null
          created_at?: string | null
          galaxy_score?: number | null
          id?: number
          interactions?: number | null
          price_usd?: number | null
          sentiment?: number | null
          social_volume?: number | null
          timeframe?: string
          timestamp?: string
          token_symbol?: string
        }
        Relationships: []
      }
      tradingview_assets: {
        Row: {
          asset_id: string
          exchange: string | null
          id: string
          is_supported: boolean | null
          tradingview_symbol: string
        }
        Insert: {
          asset_id: string
          exchange?: string | null
          id?: string
          is_supported?: boolean | null
          tradingview_symbol: string
        }
        Update: {
          asset_id?: string
          exchange?: string | null
          id?: string
          is_supported?: boolean | null
          tradingview_symbol?: string
        }
        Relationships: [
          {
            foreignKeyName: "tradingview_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradingview_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "ticker_mappings_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      api_calls_daily: {
        Row: {
          api: string | null
          call_count: number | null
          day: string | null
        }
        Relationships: []
      }
      cache_perf_daily: {
        Row: {
          avg_total_latency_ms: number | null
          day: string | null
          requests: number | null
          with_data_sources: number | null
        }
        Relationships: []
      }
      ticker_mappings_v2: {
        Row: {
          alt_rank: number | null
          coingecko_id: string | null
          created_at: string | null
          dex_address: string | null
          dex_chain: string | null
          display_name: string | null
          galaxy_score: number | null
          id: string | null
          is_active: boolean | null
          logo_url: string | null
          polygon_ticker: string | null
          symbol: string | null
          tradingview_supported: boolean | null
          tradingview_symbol: string | null
          type: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_approve_pending_mappings: {
        Args: never
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
      cleanup_expired_cache: { Args: never; Returns: undefined }
      cleanup_expired_price_cache: { Args: never; Returns: undefined }
      cleanup_old_asset_sentiments: { Args: never; Returns: undefined }
      get_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          command: string
          database: string
          jobid: number
          jobname: string
          nodename: string
          nodeport: number
          schedule: string
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      norm_symbol: { Args: { raw_symbol: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const

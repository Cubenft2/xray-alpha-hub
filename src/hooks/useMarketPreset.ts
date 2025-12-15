/**
 * Hook to execute canonical market presets
 * Single source of truth for both UI and AI
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MarketPreset, PRESET_MAP } from '@/config/marketPresets';

// CoinData interface for market preset responses
export interface CoinData {
  symbol: string;
  name: string;
  price: number;
  market_cap: number;
  market_cap_rank: number;
  volume_24h: number;
  percent_change_24h: number;
  percent_change_1h?: number;
  percent_change_7d?: number;
  galaxy_score?: number;
  alt_rank?: number;
  sentiment?: number;
  social_volume_24h?: number;
  categories?: string[];
  logo_url?: string;
}

export interface PresetExecutionResult {
  data: CoinData[];
  preset: MarketPreset;
  executionTime: number;
  rowCount: number;
  cacheHit: boolean;
  timestamp: string;
}

interface PresetQueryResult {
  success: boolean;
  data: CoinData[];
  metadata: {
    total_coins: number;
    last_updated: string;
  };
  error?: string;
}

/**
 * Execute a market preset by ID
 */
export function useMarketPreset(presetId: string | null, enabled = true) {
  const preset = presetId ? PRESET_MAP.get(presetId) : null;

  return useQuery({
    queryKey: ['market-preset', presetId],
    queryFn: async (): Promise<PresetExecutionResult> => {
      if (!preset) {
        throw new Error(`Unknown preset: ${presetId}`);
      }

      const startTime = performance.now();

      console.log(`MARKET_PRESET_EXECUTING preset=${preset.id}`);

      const { data, error } = await supabase.functions.invoke<PresetQueryResult>('lunarcrush-universe', {
        body: {
          limit: preset.query.limit,
          offset: 0,
          sortBy: preset.query.sortBy,
          sortDir: preset.query.sortDir,
          changeFilter: preset.query.changeFilter,
          category: preset.query.categoryFilter,
          minVolume: preset.query.minVolume,
          minGalaxyScore: preset.query.minGalaxyScore,
          minMarketCap: preset.query.minMarketCap,
        },
      });

      const endTime = performance.now();
      const executionTime = Math.round(endTime - startTime);

      if (error) {
        console.error(`MARKET_PRESET_ERROR preset=${preset.id} error=${error.message}`);
        throw error;
      }

      if (!data?.success) {
        console.error(`MARKET_PRESET_FAILED preset=${preset.id} error=${data?.error}`);
        throw new Error(data?.error || 'Preset execution failed');
      }

      const result: PresetExecutionResult = {
        data: data.data || [],
        preset,
        executionTime,
        rowCount: data.data?.length || 0,
        cacheHit: false, // We don't have cache info from the edge function yet
        timestamp: new Date().toISOString(),
      };

      console.log(`MARKET_PRESET_EXECUTED preset=${preset.id} rows=${result.rowCount} latency_ms=${executionTime}`);

      return result;
    },
    enabled: enabled && !!preset,
    staleTime: (preset?.ttlSeconds || 300) * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Execute preset directly (for AI/imperative use)
 */
export async function executePreset(presetId: string): Promise<PresetExecutionResult> {
  const preset = PRESET_MAP.get(presetId);
  
  if (!preset) {
    throw new Error(`Unknown preset: ${presetId}`);
  }

  const startTime = performance.now();

  console.log(`MARKET_PRESET_EXECUTING preset=${preset.id}`);

  const { data, error } = await supabase.functions.invoke<PresetQueryResult>('lunarcrush-universe', {
    body: {
      limit: preset.query.limit,
      offset: 0,
      sortBy: preset.query.sortBy,
      sortDir: preset.query.sortDir,
      changeFilter: preset.query.changeFilter,
      category: preset.query.categoryFilter,
      minVolume: preset.query.minVolume,
      minGalaxyScore: preset.query.minGalaxyScore,
      minMarketCap: preset.query.minMarketCap,
    },
  });

  const endTime = performance.now();
  const executionTime = Math.round(endTime - startTime);

  if (error) {
    console.error(`MARKET_PRESET_ERROR preset=${preset.id} error=${error.message}`);
    throw error;
  }

  if (!data?.success) {
    console.error(`MARKET_PRESET_FAILED preset=${preset.id} error=${data?.error}`);
    throw new Error(data?.error || 'Preset execution failed');
  }

  const result: PresetExecutionResult = {
    data: data.data || [],
    preset,
    executionTime,
    rowCount: data.data?.length || 0,
    cacheHit: false,
    timestamp: new Date().toISOString(),
  };

  console.log(`MARKET_PRESET_EXECUTED preset=${preset.id} rows=${result.rowCount} latency_ms=${executionTime}`);

  return result;
}

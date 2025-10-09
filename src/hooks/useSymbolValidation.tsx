import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ValidationResult {
  normalized: string;
  resolved: boolean;
  display_name?: string;
  has_price?: boolean;
  has_tv?: boolean;
  has_derivs?: boolean;
  has_social?: boolean;
  asset_type?: string;
  coingecko_id?: string;
  polygon_ticker?: string;
  tradingview_symbol?: string;
}

interface ValidationResponse {
  found: ValidationResult[];
  missing: Array<{ symbol: string; normalized: string }>;
  cached: boolean;
}

export function useSymbolValidation() {
  const [isValidating, setIsValidating] = useState(false);

  const validateSymbols = useCallback(async (symbols: string[]): Promise<ValidationResponse | null> => {
    if (!symbols.length) return null;

    try {
      setIsValidating(true);
      
      const { data, error } = await supabase.functions.invoke('symbol-intelligence', {
        body: { symbols }
      });

      if (error) {
        console.error('Symbol validation error:', error);
        return null;
      }

      // Normalize various possible payload shapes from the edge function
      const normalizeResult = (raw: any) => {
        const sym = (raw?.normalized ?? raw?.normalized_symbol ?? raw?.symbol ?? '').toString().trim().toUpperCase();
        const has_price = raw?.has_price ?? raw?.price_ok ?? raw?.price_supported;
        const has_tv = raw?.has_tv ?? raw?.tv_ok ?? raw?.tradingview_supported;
        const has_derivs = raw?.has_derivs ?? raw?.derivs_ok ?? raw?.derivs_supported;
        const has_social = raw?.has_social ?? raw?.social_ok ?? raw?.social_supported;
        const tradingview_symbol = raw?.tradingview_symbol ?? raw?.tv_symbol ?? undefined;
        const polygon_ticker = raw?.polygon_ticker ?? raw?.polygon ?? undefined;
        const coingecko_id = raw?.coingecko_id ?? raw?.cg_id ?? undefined;
        let asset_type = raw?.asset_type as string | undefined;
        if (!asset_type) {
          if (coingecko_id) asset_type = 'crypto';
          else if (typeof tradingview_symbol === 'string' && /^(NASDAQ|NYSE|AMEX|ARCA|BATS|CBOE):/i.test(tradingview_symbol)) asset_type = 'stock';
        }
        const resolved = raw?.resolved ?? !!(tradingview_symbol || coingecko_id || polygon_ticker);
        return {
          normalized: sym,
          resolved,
          display_name: raw?.display_name ?? raw?.name,
          has_price,
          has_tv,
          has_derivs,
          has_social,
          asset_type,
          coingecko_id,
          polygon_ticker,
          tradingview_symbol,
        } as ValidationResult;
      };

      const anyData: any = data;
      const incomingFound = Array.isArray(anyData?.found)
        ? anyData.found
        : Array.isArray(anyData?.symbols)
        ? anyData.symbols
        : Array.isArray(anyData?.results)
        ? anyData.results
        : Array.isArray(anyData)
        ? anyData
        : [];

      const found = incomingFound.map(normalizeResult);
      const foundSet = new Set(found.map((f: ValidationResult) => f.normalized.toUpperCase()));

      const incomingMissing = Array.isArray(anyData?.missing) ? anyData.missing : [];
      const missing = incomingMissing.map((m: any) => {
        if (typeof m === 'string') return { symbol: m, normalized: m.toUpperCase() };
        const s = (m?.symbol ?? '').toString();
        const n = (m?.normalized ?? m?.normalized_symbol ?? s).toString().toUpperCase();
        return { symbol: s, normalized: n };
      });

      // Ensure any input symbols not in found are marked missing
      for (const s of symbols) {
        const norm = s.toUpperCase().trim();
        if (!foundSet.has(norm) && !missing.find((x: any) => x.normalized === norm)) {
          missing.push({ symbol: s, normalized: norm });
        }
      }

      const response: ValidationResponse = {
        found,
        missing,
        cached: !!anyData?.cached,
      };

      return response;
    } catch (error) {
      console.error('Symbol validation failed:', error);
      return null;
    } finally {
      setIsValidating(false);
    }
  }, []);

  return {
    validateSymbols,
    isValidating
  };
}

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

      return data as ValidationResponse;
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

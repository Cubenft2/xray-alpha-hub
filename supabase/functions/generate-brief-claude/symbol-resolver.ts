import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

interface SymbolMapping {
  symbol: string;
  display_name: string;
  tradingview_symbol: string;
}

/**
 * Resolves symbol mappings from the database to ensure correct TradingView symbols
 * are used in the brief generation. This prevents issues like using USDT pairs
 * when USD pairs are available on major exchanges.
 */
export async function resolveSymbolMappings(symbols: string[]): Promise<Map<string, SymbolMapping>> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase
    .from('ticker_mappings')
    .select('symbol, display_name, tradingview_symbol')
    .in('symbol', symbols.map(s => s.toUpperCase()))
    .eq('is_active', true);
    
  if (error) {
    console.warn('⚠️ Failed to fetch ticker mappings:', error);
    return new Map();
  }
  
  const mappingMap = new Map(data.map(row => [row.symbol, row as SymbolMapping]));
  
  // Log any missing mappings
  const missingSymbols = symbols.filter(s => !mappingMap.has(s.toUpperCase()));
  if (missingSymbols.length > 0) {
    console.warn(`⚠️ Missing ticker mappings for: ${missingSymbols.join(', ')}`);
  }
  
  return mappingMap;
}

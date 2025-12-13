import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normSymbol(s: string): string {
  return s.trim().toUpperCase();
}

interface MarketDataResponse {
  asset: {
    symbol: string;
    name: string | null;
    type: string;
    logo_url: string | null;
  } | null;
  price: {
    current: number | null;
    change_24h: number | null;
    change_pct_24h: number | null;
    day_open: number | null;
    day_high: number | null;
    day_low: number | null;
    volume: number | null;
  } | null;
  history: any[];
  indicators: Record<string, any> | null;
  news: any[];
  is_delayed: boolean;
  source: string;
  as_of: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const query = normSymbol(body.q || body.symbol || '');
    const requestType = (body.type || '').toLowerCase();
    const includeHistory = body.history !== false;
    const includeIndicators = body.indicators !== false;
    const includeNews = body.news !== false;
    const historyDays = body.history_days || 30;

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Missing query parameter (q or symbol)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[market-data] Query: ${query}, type: ${requestType || 'auto'}`);

    // ========== STEP 1: Resolve asset ==========
    let asset: any = null;
    let resolvedType: 'crypto' | 'stock' | 'forex' = 'crypto';

    // Try exact match on assets table first
    const { data: exactMatch } = await supabase
      .from('assets')
      .select('id, symbol, name, type, logo_url')
      .eq('symbol', query)
      .maybeSingle();

    if (exactMatch) {
      asset = exactMatch;
      resolvedType = exactMatch.type as any;
    } else {
      // Try crypto_snapshot for crypto
      const { data: cryptoMatch } = await supabase
        .from('crypto_snapshot')
        .select('ticker, symbol, name, logo_url')
        .eq('symbol', query)
        .maybeSingle();

      if (cryptoMatch) {
        asset = {
          id: null,
          symbol: cryptoMatch.symbol,
          name: cryptoMatch.name,
          type: 'crypto',
          logo_url: cryptoMatch.logo_url,
        };
        resolvedType = 'crypto';
      } else {
        // Try stock_snapshot for stocks
        const { data: stockMatch } = await supabase
          .from('stock_snapshot')
          .select('ticker, symbol, name, logo_url')
          .eq('symbol', query)
          .maybeSingle();

        if (stockMatch) {
          asset = {
            id: null,
            symbol: stockMatch.symbol,
            name: stockMatch.name,
            type: 'stock',
            logo_url: stockMatch.logo_url,
          };
          resolvedType = 'stock';
        } else {
          // Check for forex (C:EURUSD format or EUR/USD)
          const forexQuery = query.includes('/') ? query : `C:${query.replace('/', '')}`;
          const displayQuery = query.includes('/') ? query : (query.length === 6 ? `${query.slice(0,3)}/${query.slice(3)}` : query);
          
          const { data: forexMatch } = await supabase
            .from('assets')
            .select('id, symbol, name, type, logo_url')
            .eq('type', 'forex')
            .or(`symbol.eq.${displayQuery},symbol.eq.${query}`)
            .maybeSingle();

          if (forexMatch) {
            asset = forexMatch;
            resolvedType = 'forex';
          }
        }
      }
    }

    // Override type if explicitly requested
    if (requestType === 'stock') resolvedType = 'stock';
    if (requestType === 'crypto') resolvedType = 'crypto';
    if (requestType === 'forex') resolvedType = 'forex';

    console.log(`[market-data] Resolved: ${asset?.symbol || query} as ${resolvedType}`);

    // ========== STEP 2: Get latest price ==========
    let priceData: any = null;
    let isDelayed = false;

    // Determine the ticker format for live_prices lookup
    const priceSymbol = asset?.symbol || query;
    
    // Try live_prices first
    const { data: livePrice } = await supabase
      .from('live_prices')
      .select('*')
      .eq('ticker', priceSymbol)
      .maybeSingle();

    if (livePrice) {
      priceData = {
        current: livePrice.price,
        change_24h: livePrice.change24h,
        change_pct_24h: livePrice.change24h, // Same field in this table
        day_open: livePrice.day_open || null,
        day_high: livePrice.day_high || null,
        day_low: livePrice.day_low || null,
        volume: livePrice.volume || null,
      };
      isDelayed = livePrice.is_delayed ?? (resolvedType === 'stock');
    } else {
      // Fallback to snapshot tables
      if (resolvedType === 'crypto') {
        const { data: snapshot } = await supabase
          .from('crypto_snapshot')
          .select('price, change_24h, open_24h, high_24h, low_24h, volume_24h, updated_at')
          .eq('symbol', priceSymbol)
          .maybeSingle();

        if (snapshot) {
          priceData = {
            current: snapshot.price,
            change_24h: snapshot.change_24h,
            change_pct_24h: snapshot.change_24h,
            day_open: snapshot.open_24h,
            day_high: snapshot.high_24h,
            day_low: snapshot.low_24h,
            volume: snapshot.volume_24h,
          };
        }
      } else if (resolvedType === 'stock') {
        const { data: snapshot } = await supabase
          .from('stock_snapshot')
          .select('price, change_24h, change_percent, open_price, high_24h, low_24h, volume_24h, updated_at')
          .eq('symbol', priceSymbol)
          .maybeSingle();

        if (snapshot) {
          priceData = {
            current: snapshot.price,
            change_24h: snapshot.change_24h,
            change_pct_24h: snapshot.change_percent,
            day_open: snapshot.open_price,
            day_high: snapshot.high_24h,
            day_low: snapshot.low_24h,
            volume: snapshot.volume_24h,
          };
          isDelayed = true; // Stocks Starter plan = delayed
        }
      }
    }

    // ========== STEP 3: Get price history (optional) ==========
    let history: any[] = [];
    if (includeHistory) {
      const { data: bars } = await supabase
        .from('price_history')
        .select('timestamp, open, high, low, close, volume')
        .eq('ticker', priceSymbol)
        .eq('timeframe', '1d')
        .order('timestamp', { ascending: false })
        .limit(historyDays);

      history = (bars || []).reverse();
    }

    // ========== STEP 4: Get indicators (optional) ==========
    let indicators: Record<string, any> | null = null;
    if (includeIndicators) {
      const { data: indicatorData } = await supabase
        .from('technical_indicators')
        .select('indicator_type, value, timestamp')
        .eq('ticker', priceSymbol)
        .gt('expires_at', new Date().toISOString());

      if (indicatorData && indicatorData.length > 0) {
        indicators = {};
        for (const ind of indicatorData) {
          indicators[ind.indicator_type] = ind.value;
        }
      }
    }

    // ========== STEP 5: Get news (stocks only, optional) ==========
    let news: any[] = [];
    if (includeNews && resolvedType === 'stock') {
      const { data: newsData } = await supabase
        .from('news_cache')
        .select('title, source, url, published_at, summary')
        .eq('symbol', priceSymbol)
        .order('published_at', { ascending: false })
        .limit(10);

      news = newsData || [];
    }

    const duration = Date.now() - startTime;

    const response: MarketDataResponse = {
      asset: asset ? {
        symbol: asset.symbol,
        name: asset.name,
        type: resolvedType,
        logo_url: asset.logo_url,
      } : null,
      price: priceData,
      history,
      indicators,
      news,
      is_delayed: isDelayed,
      source: 'massive',
      as_of: livePrice?.updated_at || null,
    };

    console.log(`[market-data] Completed in ${duration}ms: ${asset?.symbol || query} (${resolvedType})`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[market-data] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

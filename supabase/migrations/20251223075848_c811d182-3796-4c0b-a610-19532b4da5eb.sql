-- Add WebSocket real-time price columns to token_cards
-- This adds a 4th data source (alongside Polygon, CoinGecko, LunarCrush)

-- WebSocket price data columns
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS ws_price_usd NUMERIC;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS ws_open_24h NUMERIC;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS ws_high_24h NUMERIC;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS ws_low_24h NUMERIC;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS ws_close_24h NUMERIC;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS ws_vwap_24h NUMERIC;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS ws_volume_24h NUMERIC;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS ws_change_24h_pct NUMERIC;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS ws_price_updated_at TIMESTAMPTZ;

-- Create index for fast lookups of tokens with fresh WS data
CREATE INDEX IF NOT EXISTS idx_token_cards_ws_updated ON token_cards(ws_price_updated_at) WHERE ws_price_updated_at IS NOT NULL;

-- Update compute_display_price trigger to include WebSocket as priority source
CREATE OR REPLACE FUNCTION public.compute_display_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  freshest_source TEXT := NULL;
  freshest_ts TIMESTAMPTZ := NULL;
BEGIN
  -- Determine the freshest price source by comparing timestamps
  -- Check WebSocket (highest priority if recent - within 60 seconds)
  IF NEW.ws_price_updated_at IS NOT NULL AND NEW.ws_price_updated_at > (now() - interval '60 seconds') THEN
    IF freshest_ts IS NULL OR NEW.ws_price_updated_at > freshest_ts THEN
      freshest_ts := NEW.ws_price_updated_at;
      freshest_source := 'websocket';
    END IF;
  END IF;
  
  -- Check Polygon
  IF NEW.polygon_price_updated_at IS NOT NULL THEN
    IF freshest_ts IS NULL OR NEW.polygon_price_updated_at > freshest_ts THEN
      freshest_ts := NEW.polygon_price_updated_at;
      freshest_source := 'polygon';
    END IF;
  END IF;
  
  -- Check LunarCrush
  IF NEW.lunarcrush_price_updated_at IS NOT NULL THEN
    IF freshest_ts IS NULL OR NEW.lunarcrush_price_updated_at > freshest_ts THEN
      freshest_ts := NEW.lunarcrush_price_updated_at;
      freshest_source := 'lunarcrush';
    END IF;
  END IF;
  
  -- Check CoinGecko
  IF NEW.coingecko_price_updated_at IS NOT NULL THEN
    IF freshest_ts IS NULL OR NEW.coingecko_price_updated_at > freshest_ts THEN
      freshest_ts := NEW.coingecko_price_updated_at;
      freshest_source := 'coingecko';
    END IF;
  END IF;
  
  -- Set display price from freshest source
  IF freshest_source = 'websocket' THEN
    NEW.price_usd := NEW.ws_price_usd;
    NEW.volume_24h_usd := NEW.ws_volume_24h;
    NEW.change_24h_pct := NEW.ws_change_24h_pct;
    NEW.high_24h := NEW.ws_high_24h;
    NEW.low_24h := NEW.ws_low_24h;
    NEW.price_updated_at := NEW.ws_price_updated_at;
    NEW.price_source := 'websocket';
  ELSIF freshest_source = 'polygon' THEN
    NEW.price_usd := NEW.polygon_price_usd;
    NEW.volume_24h_usd := NEW.polygon_volume_24h;
    NEW.change_24h_pct := NEW.polygon_change_24h_pct;
    NEW.high_24h := NEW.polygon_high_24h;
    NEW.low_24h := NEW.polygon_low_24h;
    NEW.price_updated_at := NEW.polygon_price_updated_at;
    NEW.price_source := 'polygon';
  ELSIF freshest_source = 'lunarcrush' THEN
    NEW.price_usd := NEW.lunarcrush_price_usd;
    NEW.volume_24h_usd := NEW.lunarcrush_volume_24h;
    NEW.change_24h_pct := NEW.lunarcrush_change_24h_pct;
    NEW.high_24h := NEW.lunarcrush_high_24h;
    NEW.low_24h := NEW.lunarcrush_low_24h;
    NEW.price_updated_at := NEW.lunarcrush_price_updated_at;
    NEW.price_source := 'lunarcrush';
  ELSIF freshest_source = 'coingecko' THEN
    NEW.price_usd := NEW.coingecko_price_usd;
    NEW.volume_24h_usd := NEW.coingecko_volume_24h;
    NEW.change_24h_pct := NEW.coingecko_change_24h_pct;
    NEW.high_24h := NEW.coingecko_high_24h;
    NEW.low_24h := NEW.coingecko_low_24h;
    NEW.price_updated_at := NEW.coingecko_price_updated_at;
    NEW.price_source := 'coingecko';
  END IF;
  
  -- CoinGecko is authoritative for market cap and rank (most comprehensive)
  IF NEW.coingecko_market_cap IS NOT NULL THEN
    NEW.market_cap := NEW.coingecko_market_cap;
  END IF;
  
  IF NEW.coingecko_market_cap_rank IS NOT NULL THEN
    NEW.market_cap_rank := NEW.coingecko_market_cap_rank;
  END IF;
  
  -- CoinGecko is authoritative for supply data
  IF NEW.coingecko_circulating_supply IS NOT NULL THEN
    NEW.circulating_supply := NEW.coingecko_circulating_supply;
  END IF;
  
  IF NEW.coingecko_total_supply IS NOT NULL THEN
    NEW.total_supply := NEW.coingecko_total_supply;
  END IF;
  
  IF NEW.coingecko_max_supply IS NOT NULL THEN
    NEW.max_supply := NEW.coingecko_max_supply;
  END IF;
  
  RETURN NEW;
END;
$function$;
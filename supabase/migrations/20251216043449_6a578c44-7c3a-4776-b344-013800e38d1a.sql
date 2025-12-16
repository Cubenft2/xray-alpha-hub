-- Add dedicated CoinGecko columns to token_cards for true master card architecture
-- Every source (Polygon, LunarCrush, CoinGecko) gets its own dedicated spot

-- CoinGecko Price & Volume (dedicated spot - no overwrites)
ALTER TABLE public.token_cards ADD COLUMN IF NOT EXISTS coingecko_price_usd NUMERIC;
ALTER TABLE public.token_cards ADD COLUMN IF NOT EXISTS coingecko_volume_24h NUMERIC;
ALTER TABLE public.token_cards ADD COLUMN IF NOT EXISTS coingecko_change_24h_pct NUMERIC;
ALTER TABLE public.token_cards ADD COLUMN IF NOT EXISTS coingecko_high_24h NUMERIC;
ALTER TABLE public.token_cards ADD COLUMN IF NOT EXISTS coingecko_low_24h NUMERIC;
ALTER TABLE public.token_cards ADD COLUMN IF NOT EXISTS coingecko_price_updated_at TIMESTAMPTZ;

-- CoinGecko Market Data (authoritative source for market cap)
ALTER TABLE public.token_cards ADD COLUMN IF NOT EXISTS coingecko_market_cap NUMERIC;
ALTER TABLE public.token_cards ADD COLUMN IF NOT EXISTS coingecko_market_cap_rank INTEGER;
ALTER TABLE public.token_cards ADD COLUMN IF NOT EXISTS coingecko_circulating_supply NUMERIC;
ALTER TABLE public.token_cards ADD COLUMN IF NOT EXISTS coingecko_total_supply NUMERIC;
ALTER TABLE public.token_cards ADD COLUMN IF NOT EXISTS coingecko_max_supply NUMERIC;

-- CoinGecko Historical (unique to CG - ATH/ATL data)
ALTER TABLE public.token_cards ADD COLUMN IF NOT EXISTS coingecko_ath_price NUMERIC;
ALTER TABLE public.token_cards ADD COLUMN IF NOT EXISTS coingecko_ath_date TIMESTAMPTZ;
ALTER TABLE public.token_cards ADD COLUMN IF NOT EXISTS coingecko_atl_price NUMERIC;
ALTER TABLE public.token_cards ADD COLUMN IF NOT EXISTS coingecko_atl_date TIMESTAMPTZ;

-- Drop and recreate the compute_display_price trigger to compare 3 sources
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
  IF freshest_source = 'polygon' THEN
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

-- Ensure trigger exists
DROP TRIGGER IF EXISTS compute_display_price_trigger ON public.token_cards;
CREATE TRIGGER compute_display_price_trigger
  BEFORE INSERT OR UPDATE ON public.token_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_display_price();

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_token_cards_coingecko_price_updated ON public.token_cards(coingecko_price_updated_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_token_cards_coingecko_market_cap_rank ON public.token_cards(coingecko_market_cap_rank ASC NULLS LAST);
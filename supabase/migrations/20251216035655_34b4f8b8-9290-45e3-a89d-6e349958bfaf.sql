-- Step 1: Drop the broken validation trigger
DROP TRIGGER IF EXISTS token_cards_consistency_check ON token_cards;
DROP FUNCTION IF EXISTS validate_token_cards_consistency();

-- Step 2: Add dedicated price columns for LunarCrush
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS lunarcrush_price_usd numeric;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS lunarcrush_volume_24h numeric;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS lunarcrush_change_24h_pct numeric;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS lunarcrush_high_24h numeric;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS lunarcrush_low_24h numeric;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS lunarcrush_price_updated_at timestamptz;

-- Step 3: Add dedicated price columns for Polygon
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS polygon_price_usd numeric;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS polygon_volume_24h numeric;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS polygon_change_24h_pct numeric;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS polygon_high_24h numeric;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS polygon_low_24h numeric;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS polygon_price_updated_at timestamptz;

-- Step 4: Create trigger to compute display price from freshest source
CREATE OR REPLACE FUNCTION public.compute_display_price()
RETURNS TRIGGER AS $$
BEGIN
  -- Pick the freshest price for display
  IF NEW.polygon_price_updated_at IS NOT NULL AND NEW.lunarcrush_price_updated_at IS NOT NULL THEN
    -- Both sources have data - use the fresher one
    IF NEW.polygon_price_updated_at > NEW.lunarcrush_price_updated_at THEN
      NEW.price_usd := NEW.polygon_price_usd;
      NEW.volume_24h_usd := NEW.polygon_volume_24h;
      NEW.change_24h_pct := NEW.polygon_change_24h_pct;
      NEW.high_24h := NEW.polygon_high_24h;
      NEW.low_24h := NEW.polygon_low_24h;
      NEW.price_updated_at := NEW.polygon_price_updated_at;
      NEW.price_source := 'polygon';
    ELSE
      NEW.price_usd := NEW.lunarcrush_price_usd;
      NEW.volume_24h_usd := NEW.lunarcrush_volume_24h;
      NEW.change_24h_pct := NEW.lunarcrush_change_24h_pct;
      NEW.high_24h := NEW.lunarcrush_high_24h;
      NEW.low_24h := NEW.lunarcrush_low_24h;
      NEW.price_updated_at := NEW.lunarcrush_price_updated_at;
      NEW.price_source := 'lunarcrush';
    END IF;
  ELSIF NEW.polygon_price_updated_at IS NOT NULL THEN
    -- Only Polygon has data
    NEW.price_usd := NEW.polygon_price_usd;
    NEW.volume_24h_usd := NEW.polygon_volume_24h;
    NEW.change_24h_pct := NEW.polygon_change_24h_pct;
    NEW.high_24h := NEW.polygon_high_24h;
    NEW.low_24h := NEW.polygon_low_24h;
    NEW.price_updated_at := NEW.polygon_price_updated_at;
    NEW.price_source := 'polygon';
  ELSIF NEW.lunarcrush_price_updated_at IS NOT NULL THEN
    -- Only LunarCrush has data
    NEW.price_usd := NEW.lunarcrush_price_usd;
    NEW.volume_24h_usd := NEW.lunarcrush_volume_24h;
    NEW.change_24h_pct := NEW.lunarcrush_change_24h_pct;
    NEW.high_24h := NEW.lunarcrush_high_24h;
    NEW.low_24h := NEW.lunarcrush_low_24h;
    NEW.price_updated_at := NEW.lunarcrush_price_updated_at;
    NEW.price_source := 'lunarcrush';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Step 5: Create the trigger
DROP TRIGGER IF EXISTS compute_display_price_trigger ON token_cards;
CREATE TRIGGER compute_display_price_trigger
BEFORE INSERT OR UPDATE ON token_cards
FOR EACH ROW EXECUTE FUNCTION compute_display_price();

-- Step 6: Migrate existing data to dedicated columns based on current price_source
UPDATE token_cards 
SET 
  polygon_price_usd = price_usd,
  polygon_volume_24h = volume_24h_usd,
  polygon_change_24h_pct = change_24h_pct,
  polygon_high_24h = high_24h,
  polygon_low_24h = low_24h,
  polygon_price_updated_at = price_updated_at
WHERE price_source = 'polygon';

UPDATE token_cards 
SET 
  lunarcrush_price_usd = price_usd,
  lunarcrush_volume_24h = volume_24h_usd,
  lunarcrush_change_24h_pct = change_24h_pct,
  lunarcrush_high_24h = high_24h,
  lunarcrush_low_24h = low_24h,
  lunarcrush_price_updated_at = price_updated_at
WHERE price_source = 'lunarcrush' OR price_source IS NULL;
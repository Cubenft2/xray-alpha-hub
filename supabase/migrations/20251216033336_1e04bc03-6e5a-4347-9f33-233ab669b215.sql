-- Step 1: Remove the incorrect DEFAULT from price_source
ALTER TABLE token_cards ALTER COLUMN price_source DROP DEFAULT;

-- Step 2: Create validation trigger function to prevent contradictory data
CREATE OR REPLACE FUNCTION public.validate_token_cards_consistency()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent polygon_supported=false with price_source='polygon'
  IF NEW.polygon_supported = false AND NEW.price_source = 'polygon' THEN
    NEW.price_source := 'lunarcrush';
  END IF;
  
  -- Prevent polygon_supported=true with price_source='lunarcrush' for price fields
  -- (This gets auto-healed by allowing NULL, letting polygon sync fill it)
  IF NEW.polygon_supported = true AND NEW.price_source = 'lunarcrush' THEN
    NEW.price_source := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Step 3: Create the trigger
DROP TRIGGER IF EXISTS token_cards_consistency_check ON token_cards;
CREATE TRIGGER token_cards_consistency_check
BEFORE INSERT OR UPDATE ON token_cards
FOR EACH ROW EXECUTE FUNCTION validate_token_cards_consistency();

-- Step 4: Fix existing contradictory data
-- Fix polygon_supported=false but price_source='polygon'
UPDATE token_cards 
SET price_source = 'lunarcrush'
WHERE polygon_supported = false 
  AND price_source = 'polygon';

-- Fix polygon_supported=true but price_source='lunarcrush'  
UPDATE token_cards
SET price_source = NULL
WHERE polygon_supported = true 
  AND price_source = 'lunarcrush';

-- Fix NULL polygon_supported with price_source='polygon'
UPDATE token_cards
SET price_source = NULL
WHERE polygon_supported IS NULL 
  AND price_source = 'polygon';
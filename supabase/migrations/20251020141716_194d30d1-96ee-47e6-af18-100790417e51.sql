-- Fix security issue: Set search_path for validate_tradingview_symbol function
-- Must drop trigger first, then function, then recreate both

DROP TRIGGER IF EXISTS check_tradingview_symbol ON ticker_mappings;
DROP FUNCTION IF EXISTS validate_tradingview_symbol();

CREATE OR REPLACE FUNCTION validate_tradingview_symbol()
RETURNS TRIGGER AS $$
BEGIN
  -- Warn if using USDT for major exchanges that typically support USD
  IF NEW.tradingview_symbol LIKE '%USDT' 
     AND (NEW.tradingview_symbol LIKE 'COINBASE:%' 
          OR NEW.tradingview_symbol LIKE 'KRAKEN:%'
          OR NEW.tradingview_symbol LIKE 'GEMINI:%') THEN
    RAISE WARNING 'Symbol % uses USDT on an exchange that typically supports USD pairs. Consider using USD instead: %', 
                  NEW.symbol, NEW.tradingview_symbol;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public;

CREATE TRIGGER check_tradingview_symbol
BEFORE INSERT OR UPDATE ON ticker_mappings
FOR EACH ROW
EXECUTE FUNCTION validate_tradingview_symbol();
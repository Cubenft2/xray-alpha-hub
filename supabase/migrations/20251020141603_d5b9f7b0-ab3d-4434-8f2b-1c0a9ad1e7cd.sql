-- Part 1: Fix ticker_mappings for CRO, LINK, LEO, MEMECORE

-- Fix CRO to use USD pair on Coinbase
UPDATE ticker_mappings 
SET tradingview_symbol = 'COINBASE:CROUSD',
    display_name = 'Cronos (CRO)',
    updated_at = now()
WHERE symbol = 'CRO';

-- Fix LINK to use USD pair on Coinbase
UPDATE ticker_mappings
SET tradingview_symbol = 'COINBASE:LINKUSD',
    display_name = 'Chainlink (LINK)',
    updated_at = now()
WHERE symbol = 'LINK';

-- Fix LEO to use OKX with USDT (OKX supports both USD and USDT)
UPDATE ticker_mappings
SET tradingview_symbol = 'OKX:LEOUSDT',
    display_name = 'UNUS SED LEO (LEO)',
    updated_at = now()
WHERE symbol = 'LEO';

-- Add/Update MEMECORE with MEXC
INSERT INTO ticker_mappings (
    symbol,
    display_name,
    type,
    tradingview_symbol,
    is_active
) VALUES (
    'MEMECORE',
    'MemeCore (MEMECORE)',
    'crypto',
    'MEXC:MEMECOREUSDT',
    true
)
ON CONFLICT (symbol) DO UPDATE
SET tradingview_symbol = 'MEXC:MEMECOREUSDT',
    display_name = 'MemeCore (MEMECORE)',
    updated_at = now();

-- Part 3: Add validation trigger to prevent USDT when USD is available

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
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_tradingview_symbol
BEFORE INSERT OR UPDATE ON ticker_mappings
FOR EACH ROW
EXECUTE FUNCTION validate_tradingview_symbol();
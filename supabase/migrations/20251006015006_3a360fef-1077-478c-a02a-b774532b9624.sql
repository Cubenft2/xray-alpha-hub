-- Add DeFi tokens to Polygon live price streaming
-- Update existing ticker mappings with Polygon ticker identifiers

-- Major DeFi Protocols
UPDATE ticker_mappings 
SET polygon_ticker = 'X:AAVEUSD', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'AAVE' AND polygon_ticker IS NULL;

UPDATE ticker_mappings 
SET polygon_ticker = 'X:MKRUSD', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'MKR' AND polygon_ticker IS NULL;

UPDATE ticker_mappings 
SET polygon_ticker = 'X:COMPUSD', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'COMP' AND polygon_ticker IS NULL;

UPDATE ticker_mappings 
SET polygon_ticker = 'X:CRVUSD', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'CRV' AND polygon_ticker IS NULL;

UPDATE ticker_mappings 
SET polygon_ticker = 'X:SNXUSD', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'SNX' AND polygon_ticker IS NULL;

UPDATE ticker_mappings 
SET polygon_ticker = 'X:YFIUSD', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'YFI' AND polygon_ticker IS NULL;

-- DEX Tokens
UPDATE ticker_mappings 
SET polygon_ticker = 'X:SUSHIUSD', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'SUSHI' AND polygon_ticker IS NULL;

UPDATE ticker_mappings 
SET polygon_ticker = 'X:1INCHUSD', 
    price_supported = true,
    updated_at = now()
WHERE symbol = '1INCH' AND polygon_ticker IS NULL;

UPDATE ticker_mappings 
SET polygon_ticker = 'X:GMXUSD', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'GMX' AND polygon_ticker IS NULL;

UPDATE ticker_mappings 
SET polygon_ticker = 'X:BALUSD', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'BAL' AND polygon_ticker IS NULL;

UPDATE ticker_mappings 
SET polygon_ticker = 'X:CAKEUSD', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'CAKE' AND polygon_ticker IS NULL;

-- Polkadot Ecosystem
UPDATE ticker_mappings 
SET polygon_ticker = 'X:ASTERUSD', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'ASTER' AND polygon_ticker IS NULL;
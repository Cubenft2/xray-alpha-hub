-- Add missing TradingView tape tokens to Polygon live price streaming
-- Update existing ticker mappings with Polygon ticker identifiers

-- Meme Tokens
UPDATE ticker_mappings 
SET polygon_ticker = 'X:SHIBUSD', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'SHIB' AND polygon_ticker IS NULL;

-- Major Cryptocurrencies
UPDATE ticker_mappings 
SET polygon_ticker = 'X:BCHUSD', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'BCH' AND polygon_ticker IS NULL;

-- Layer 1/2 Tokens
UPDATE ticker_mappings 
SET polygon_ticker = 'X:ZETAUSD', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'ZETA' AND polygon_ticker IS NULL;

UPDATE ticker_mappings 
SET polygon_ticker = 'X:SEIUSDT', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'SEI' AND polygon_ticker IS NULL;

UPDATE ticker_mappings 
SET polygon_ticker = 'X:FLRUSD', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'FLR' AND polygon_ticker IS NULL;

UPDATE ticker_mappings 
SET polygon_ticker = 'X:ASTRUSDT', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'ASTR' AND polygon_ticker IS NULL;

-- DeFi/DEX Tokens
UPDATE ticker_mappings 
SET polygon_ticker = 'X:CETUSUSDT', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'CETUS' AND polygon_ticker IS NULL;

UPDATE ticker_mappings 
SET polygon_ticker = 'X:JUPUSDT', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'JUP' AND polygon_ticker IS NULL;

-- Exchange Tokens
UPDATE ticker_mappings 
SET polygon_ticker = 'X:OKBUSDT', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'OKB' AND polygon_ticker IS NULL;

-- New/Trending Tokens
UPDATE ticker_mappings 
SET polygon_ticker = 'X:WLFIUSDT', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'WLFI' AND polygon_ticker IS NULL;

UPDATE ticker_mappings 
SET polygon_ticker = 'X:PENGUUSDT', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'PENGU' AND polygon_ticker IS NULL;

UPDATE ticker_mappings 
SET polygon_ticker = 'X:AVNTUSDT', 
    price_supported = true,
    updated_at = now()
WHERE symbol = 'AVNT' AND polygon_ticker IS NULL;
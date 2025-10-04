-- Fix ASTER mapping to use correct CoinGecko ID (aster-2)
UPDATE ticker_mappings 
SET coingecko_id = 'aster-2',
    display_name = 'Aster',
    tradingview_symbol = 'MEXC:ASTERUSDT',
    updated_at = now()
WHERE symbol = 'ASTER';

-- Ensure ASTAR (Astar Network) exists with correct mapping
INSERT INTO ticker_mappings (symbol, display_name, coingecko_id, tradingview_symbol, type, is_active)
VALUES ('ASTAR', 'Astar Network', 'astar', 'BINANCE:ASTRUSDT', 'crypto', true)
ON CONFLICT (symbol) DO UPDATE
SET coingecko_id = 'astar',
    display_name = 'Astar Network',
    tradingview_symbol = 'BINANCE:ASTRUSDT',
    updated_at = now();
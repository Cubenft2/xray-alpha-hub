-- Add missing important crypto tickers for Polygon live price streaming
-- These will be automatically picked up by the polygon-price-relay edge function

-- Top Market Cap Tokens (Missing from current 50)
INSERT INTO ticker_mappings (symbol, display_name, type, polygon_ticker, tradingview_symbol, is_active, price_supported) VALUES
('BNB', 'BNB', 'crypto', 'X:BNBUSD', 'BINANCE:BNBUSDT', true, true),
('USDC', 'USD Coin', 'crypto', 'X:USDCUSD', 'BINANCE:USDCUSDT', true, true),
('USDT', 'Tether', 'crypto', 'X:USDTUSD', 'BINANCE:USDTUSDT', true, true),
('STETH', 'Lido Staked ETH', 'crypto', 'X:STETHUSD', 'BINANCE:STETHUSDT', true, true)
ON CONFLICT (symbol) DO UPDATE SET
  polygon_ticker = EXCLUDED.polygon_ticker,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  updated_at = now();

-- Popular Meme Coins
INSERT INTO ticker_mappings (symbol, display_name, type, polygon_ticker, tradingview_symbol, is_active, price_supported) VALUES
('FLOKI', 'FLOKI', 'crypto', 'X:FLOKIUSD', 'BINANCE:FLOKIUSDT', true, true),
('BRETT', 'Brett', 'crypto', 'X:BRETTUSD', 'MEXC:BRETTUSDT', true, true),
('POPCAT', 'Popcat', 'crypto', 'X:POPCATUSD', 'BINANCE:POPCATUSDT', true, true),
('MEW', 'Cat in a Dogs World', 'crypto', 'X:MEWUSD', 'BINANCE:MEWUSDT', true, true),
('TURBO', 'Turbo', 'crypto', 'X:TURBOUSD', 'BINANCE:TURBOUSDT', true, true)
ON CONFLICT (symbol) DO UPDATE SET
  polygon_ticker = EXCLUDED.polygon_ticker,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  updated_at = now();

-- Key DeFi/L1/L2 Tokens
INSERT INTO ticker_mappings (symbol, display_name, type, polygon_ticker, tradingview_symbol, is_active, price_supported) VALUES
('APT', 'Aptos', 'crypto', 'X:APTUSD', 'BINANCE:APTUSDT', true, true),
('TAO', 'Bittensor', 'crypto', 'X:TAOUSD', 'BINANCE:TAOUSDT', true, true),
('RUNE', 'THORChain', 'crypto', 'X:RUNEUSD', 'BINANCE:RUNEUSDT', true, true),
('INJ', 'Injective', 'crypto', 'X:INJUSD', 'BINANCE:INJUSDT', true, true),
('STX', 'Stacks', 'crypto', 'X:STXUSD', 'BINANCE:STXUSDT', true, true),
('IMX', 'Immutable X', 'crypto', 'X:IMXUSD', 'BINANCE:IMXUSDT', true, true),
('LDO', 'Lido DAO', 'crypto', 'X:LDOUSD', 'BINANCE:LDOUSDT', true, true)
ON CONFLICT (symbol) DO UPDATE SET
  polygon_ticker = EXCLUDED.polygon_ticker,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  updated_at = now();
-- Add enhanced columns to ticker_mappings table
ALTER TABLE public.ticker_mappings
ADD COLUMN IF NOT EXISTS display_symbol text,
ADD COLUMN IF NOT EXISTS coingecko_id text,
ADD COLUMN IF NOT EXISTS polygon_ticker text,
ADD COLUMN IF NOT EXISTS coinglass_symbol text,
ADD COLUMN IF NOT EXISTS dex_chain text,
ADD COLUMN IF NOT EXISTS dex_address text,
ADD COLUMN IF NOT EXISTS preferred_exchange text,
ADD COLUMN IF NOT EXISTS aliases text[];

-- Create index on display_symbol for fast lookups
CREATE INDEX IF NOT EXISTS idx_ticker_mappings_display_symbol ON public.ticker_mappings(display_symbol);
CREATE INDEX IF NOT EXISTS idx_ticker_mappings_aliases ON public.ticker_mappings USING gin(aliases);

-- Seed common token mappings with TradingView symbols
INSERT INTO public.ticker_mappings (symbol, display_name, display_symbol, type, tradingview_symbol, coingecko_id, preferred_exchange, is_active)
VALUES 
  ('BTC', 'Bitcoin', 'BTC', 'crypto', 'BINANCE:BTCUSDT', 'bitcoin', NULL, true),
  ('ETH', 'Ethereum', 'ETH', 'crypto', 'BINANCE:ETHUSDT', 'ethereum', NULL, true),
  ('SOL', 'Solana', 'SOL', 'crypto', 'BINANCE:SOLUSDT', 'solana', NULL, true),
  ('BNB', 'Binance Coin', 'BNB', 'crypto', 'BINANCE:BNBUSDT', 'binancecoin', NULL, true),
  ('XRP', 'Ripple', 'XRP', 'crypto', 'BINANCE:XRPUSDT', 'ripple', NULL, true),
  ('HYPE', 'Hyperliquid', 'HYPE', 'crypto', 'BINANCE:HYPEUSDT', 'hyperliquid', NULL, true),
  ('ASTER', 'Astar', 'ASTER', 'crypto', 'BINANCE:ASTERUSDT', 'astar', NULL, true),
  ('FF', 'Falcon Finance', 'FF', 'crypto', 'MEXC:FFUSDT', 'falcon-finance', 'MEXC', true),
  ('WETH', 'Wrapped Ethereum', 'WETH', 'crypto', 'UNISWAP:WETH', 'weth', NULL, true),
  ('WBETH', 'Wrapped Beacon ETH', 'WBETH', 'crypto', 'BINANCE:WBETHETH', 'wrapped-beacon-eth', NULL, true),
  ('WEETH', 'Wrapped eETH', 'WEETH', 'crypto', 'UNISWAP:WEETHWETH', 'wrapped-eeth', NULL, true),
  ('FIGR_HELOC', 'Figure HELOC Token', 'FIGR_HELOC', 'crypto', 'OTC:FIGR_HELOC', NULL, 'OKX', true)
ON CONFLICT (symbol) DO UPDATE SET
  display_symbol = EXCLUDED.display_symbol,
  coingecko_id = EXCLUDED.coingecko_id,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  preferred_exchange = EXCLUDED.preferred_exchange,
  is_active = EXCLUDED.is_active;

-- Add comment explaining the schema
COMMENT ON COLUMN public.ticker_mappings.display_symbol IS 'Normalized display symbol used in articles';
COMMENT ON COLUMN public.ticker_mappings.coingecko_id IS 'CoinGecko API coin ID';
COMMENT ON COLUMN public.ticker_mappings.polygon_ticker IS 'Polygon.io stock ticker symbol';
COMMENT ON COLUMN public.ticker_mappings.coinglass_symbol IS 'CoinGlass derivatives symbol';
COMMENT ON COLUMN public.ticker_mappings.dex_chain IS 'DEX chain name for DEX tokens (e.g., ethereum, bsc)';
COMMENT ON COLUMN public.ticker_mappings.dex_address IS 'DEX contract address';
COMMENT ON COLUMN public.ticker_mappings.preferred_exchange IS 'Preferred CEX for price (MEXC, Bitget, OKX)';
COMMENT ON COLUMN public.ticker_mappings.aliases IS 'Alternative symbols/names for lookup';
-- Fix HYPE (Hyperliquid) to use correct TradingView symbol
-- Not on Binance - available on KuCoin/Bitget/MEXC (USDT) and Pyth (USD)
-- Using CRYPTO:HYPEHUSD as the aggregated source per TradingView
UPDATE ticker_mappings 
SET tradingview_symbol = 'CRYPTO:HYPEHUSD',
    display_name = 'Hyperliquid (HYPE)',
    updated_at = now()
WHERE symbol = 'HYPE';

-- Add comment about why this mapping was chosen
COMMENT ON COLUMN ticker_mappings.tradingview_symbol IS 'TradingView symbol format: EXCHANGE:SYMBOL. Prefer USD over USDT. Use CRYPTO: prefix for aggregated data when asset not on major exchanges.';
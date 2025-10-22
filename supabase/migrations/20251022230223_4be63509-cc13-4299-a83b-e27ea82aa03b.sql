-- Fix Monero (XMR) mapping from Binance USDT to Kraken USD
-- Per TICKER_MAPPING_GUIDE.md: Prefer USD over USDT, Kraken is high priority
UPDATE ticker_mappings
SET 
  tradingview_symbol = 'KRAKEN:XMRUSD',
  preferred_exchange = 'Kraken',
  updated_at = now()
WHERE symbol = 'XMR';

-- Fix Sui (SUI) mapping to use Coinbase USD with proper exchange prefix
-- Per TICKER_MAPPING_GUIDE.md: Coinbase is #1 priority for USD pairs
UPDATE ticker_mappings
SET 
  tradingview_symbol = 'COINBASE:SUIUSD',
  preferred_exchange = 'Coinbase',
  updated_at = now()
WHERE symbol = 'SUI';

-- Add comment for audit trail
COMMENT ON COLUMN ticker_mappings.tradingview_symbol IS 
'TradingView symbol format: EXCHANGE:BASEUSD or EXCHANGE:BASEUSDT. Priority: USD > USDT. Exchanges: Coinbase > Kraken > Binance > OKX';
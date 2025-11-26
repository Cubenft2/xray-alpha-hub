-- Update MON ticker mapping to use Coinbase USD pair and correct CoinGecko ID
UPDATE ticker_mappings
SET 
  tradingview_symbol = 'COINBASE:MONUSD',
  coingecko_id = 'mon-protocol',
  preferred_exchange = 'coinbase',
  display_name = 'MON Protocol',
  aliases = ARRAY['MON_USDT', 'monusdt', 'MONUSDT', 'MON-USDT'],
  updated_at = now()
WHERE symbol = 'MON';
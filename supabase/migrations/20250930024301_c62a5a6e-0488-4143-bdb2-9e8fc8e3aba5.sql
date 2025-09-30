-- Insert or update FF (Falcon Finance) ticker mapping
INSERT INTO ticker_mappings (symbol, display_name, tradingview_symbol, type, exchange, is_active)
VALUES ('FF', 'Falcon Finance (FF)', 'BINANCE:FFUSDT', 'crypto', 'Binance', true)
ON CONFLICT (symbol) 
DO UPDATE SET 
  tradingview_symbol = 'BINANCE:FFUSDT',
  display_name = 'Falcon Finance (FF)',
  type = 'crypto',
  exchange = 'Binance',
  updated_at = now();
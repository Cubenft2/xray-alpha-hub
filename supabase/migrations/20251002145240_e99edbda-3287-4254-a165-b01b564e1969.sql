-- Add MYX ticker mappings for TradingView
-- MYX is a cryptocurrency token

-- Main MYX/USDT pair on Binance
INSERT INTO ticker_mappings (symbol, display_name, tradingview_symbol, type, tradingview_supported, is_active)
VALUES ('MYX', 'MYX', 'BINANCE:MYXUSDT', 'crypto', true, true)
ON CONFLICT (symbol) DO UPDATE SET
  tradingview_symbol = 'BINANCE:MYXUSDT',
  tradingview_supported = true,
  is_active = true;

-- MYX/USDT spot trading
INSERT INTO ticker_mappings (symbol, display_name, tradingview_symbol, type, tradingview_supported, is_active)
VALUES ('MYXUSDT', 'MYX/USDT', 'BINANCE:MYXUSDT', 'crypto', true, true)
ON CONFLICT (symbol) DO UPDATE SET
  tradingview_symbol = 'BINANCE:MYXUSDT',
  tradingview_supported = true,
  is_active = true;

-- MYX/USDT perpetual futures
INSERT INTO ticker_mappings (symbol, display_name, tradingview_symbol, type, tradingview_supported, is_active)
VALUES ('MYXUSDT.P', 'MYX/USDT Perpetual', 'BINANCE:MYXUSDTPERP', 'crypto', true, true)
ON CONFLICT (symbol) DO UPDATE SET
  tradingview_symbol = 'BINANCE:MYXUSDTPERP',
  tradingview_supported = true,
  is_active = true;

-- MYX/USD
INSERT INTO ticker_mappings (symbol, display_name, tradingview_symbol, type, tradingview_supported, is_active)
VALUES ('MYXUSD', 'MYX/USD', 'BINANCE:MYXUSDT', 'crypto', true, true)
ON CONFLICT (symbol) DO UPDATE SET
  tradingview_symbol = 'BINANCE:MYXUSDT',
  tradingview_supported = true,
  is_active = true;
-- Fix TradingView symbol mappings for tokens with incorrect/missing exchange mappings

-- WHBT - WhiteBIT Token (Bitfinex)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('WHBT', 'WhiteBIT Token', 'crypto', 'BITFINEX:WHBTUSD', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'BITFINEX:WHBTUSD',
  tradingview_supported = true,
  updated_at = now();

-- BCNN (Bitfinex for USD, also on Binance/OKX/Kraken for USDT)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('BCNN', 'BCNN', 'crypto', 'BITFINEX:BCNNUSD', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'BITFINEX:BCNNUSD',
  tradingview_supported = true,
  updated_at = now();

-- CLOUD (Bitfinex)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('CLOUD', 'CloudCoin', 'crypto', 'BITFINEX:CLOUDUSD', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'BITFINEX:CLOUDUSD',
  tradingview_supported = true,
  updated_at = now();

-- REPV2 - Augur V2 (Kraken)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('REPV2', 'Augur V2', 'crypto', 'KRAKEN:REPV2USD', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'KRAKEN:REPV2USD',
  tradingview_supported = true,
  updated_at = now();

-- WAXL - Wrapped Axelar (Coinbase)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('WAXL', 'Wrapped Axelar', 'crypto', 'COINBASE:WAXLUSD', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'COINBASE:WAXLUSD',
  tradingview_supported = true,
  updated_at = now();

-- DYDX (OKX)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('DYDX', 'dYdX', 'crypto', 'OKX:DYDXUSDT', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'OKX:DYDXUSDT',
  tradingview_supported = true,
  updated_at = now();

-- USDQ (Kraken)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('USDQ', 'USDQ', 'crypto', 'KRAKEN:USDQUSD', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'KRAKEN:USDQUSD',
  tradingview_supported = true,
  updated_at = now();

-- USDR (Kraken USDT pair)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('USDR', 'Real USD', 'crypto', 'KRAKEN:USDRUSDT', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'KRAKEN:USDRUSDT',
  tradingview_supported = true,
  updated_at = now();

-- NANO (Gate USDT pair)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('NANO', 'Nano', 'crypto', 'GATEIO:NANOUSDT', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'GATEIO:NANOUSDT',
  tradingview_supported = true,
  updated_at = now();

-- ETH2X (Bitfinex)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('ETH2X', 'ETH 2x Leverage', 'crypto', 'BITFINEX:ETH2XUSD', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'BITFINEX:ETH2XUSD',
  tradingview_supported = true,
  updated_at = now();

-- DSH - Dash via Pyth (Bitfinex)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('DSH', 'Dash', 'crypto', 'BITFINEX:DSHUSD', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'BITFINEX:DSHUSD',
  tradingview_supported = true,
  updated_at = now();

-- CGLD - Celo (Coinbase)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('CGLD', 'Celo', 'crypto', 'COINBASE:CGLDUSD', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'COINBASE:CGLDUSD',
  tradingview_supported = true,
  updated_at = now();

-- LIFI (Bitfinex)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('LIFI', 'LI.FI', 'crypto', 'BITFINEX:LIFIUSD', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'BITFINEX:LIFIUSD',
  tradingview_supported = true,
  updated_at = now();

-- AIR (Kraken)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('AIR', 'Altair', 'crypto', 'KRAKEN:AIRUSD', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'KRAKEN:AIRUSD',
  tradingview_supported = true,
  updated_at = now();

-- RND - Render (Bitstamp)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('RND', 'Render', 'crypto', 'BITSTAMP:RNDUSD', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'BITSTAMP:RNDUSD',
  tradingview_supported = true,
  updated_at = now();

-- FTM - Fantom (Bitstamp)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('FTM', 'Fantom', 'crypto', 'BITSTAMP:FTMUSD', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'BITSTAMP:FTMUSD',
  tradingview_supported = true,
  updated_at = now();

-- ALT2612 (Bitfinex)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('ALT2612', 'ALT2612', 'crypto', 'BITFINEX:ALT2612USD', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'BITFINEX:ALT2612USD',
  tradingview_supported = true,
  updated_at = now();

-- SGB - Songbird (Gate USDT)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('SGB', 'Songbird', 'crypto', 'GATEIO:SGBUSDT', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'GATEIO:SGBUSDT',
  tradingview_supported = true,
  updated_at = now();

-- RON - Ronin (Bitfinex)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('RON', 'Ronin', 'crypto', 'BITFINEX:RONUSD', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'BITFINEX:RONUSD',
  tradingview_supported = true,
  updated_at = now();

-- UST - Terra UST (Bitfinex)
INSERT INTO ticker_mappings (symbol, display_name, type, tradingview_symbol, is_active, tradingview_supported)
VALUES ('UST', 'TerraUSD', 'crypto', 'BITFINEX:USTUSD', true, true)
ON CONFLICT (symbol) DO UPDATE SET 
  tradingview_symbol = 'BITFINEX:USTUSD',
  tradingview_supported = true,
  updated_at = now();
-- Step 1: Clean up duplicate pending_ticker_mappings (keep most recent)
DELETE FROM pending_ticker_mappings a
USING pending_ticker_mappings b
WHERE a.id < b.id 
  AND a.normalized_symbol = b.normalized_symbol 
  AND a.status = b.status;

-- Step 2: Add unique constraint to prevent future duplicates
ALTER TABLE pending_ticker_mappings 
ADD CONSTRAINT pending_ticker_mappings_normalized_symbol_status_key 
UNIQUE (normalized_symbol, status);

-- Step 3: Insert the missing symbols directly into ticker_mappings
INSERT INTO ticker_mappings (
  symbol, 
  display_name, 
  type, 
  coingecko_id, 
  tradingview_symbol, 
  price_supported, 
  is_active,
  preferred_exchange
) VALUES
  ('COAI', 'ChainOpera AI', 'crypto', 'chainopera-ai', 'MEXC:COAIUSDT', true, true, 'MEXC'),
  ('OVPP', 'OpenVPP', 'crypto', 'openvpp', 'MEXC:OVPPUSDT', true, true, 'MEXC'),
  ('PLUME', 'Plume', 'crypto', 'plume-network', 'MEXC:PLUMEUSDT', true, true, 'MEXC')
ON CONFLICT (symbol) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  coingecko_id = EXCLUDED.coingecko_id,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  preferred_exchange = EXCLUDED.preferred_exchange,
  price_supported = EXCLUDED.price_supported,
  is_active = EXCLUDED.is_active,
  updated_at = now();
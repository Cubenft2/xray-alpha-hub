-- Fix PEPE token mapping to use correct CoinGecko ID (main PEPE token, not Based Pepe)
UPDATE ticker_mappings 
SET coingecko_id = 'pepe', 
    updated_at = now()
WHERE symbol = 'PEPE' AND coingecko_id = 'based-pepe';
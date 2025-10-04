-- Fix EVAA Protocol CoinGecko ID
UPDATE ticker_mappings 
SET coingecko_id = 'evaa-protocol',
    updated_at = now()
WHERE symbol = 'EVAA';
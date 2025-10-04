-- Update OKB, IMX, and HASH with correct CoinGecko IDs
UPDATE ticker_mappings 
SET coingecko_id = 'okb',
    updated_at = now()
WHERE symbol = 'OKB';

UPDATE ticker_mappings 
SET coingecko_id = 'immutable-x',
    updated_at = now()
WHERE symbol = 'IMX';

UPDATE ticker_mappings 
SET coingecko_id = 'hashflow',
    updated_at = now()
WHERE symbol = 'HASH';
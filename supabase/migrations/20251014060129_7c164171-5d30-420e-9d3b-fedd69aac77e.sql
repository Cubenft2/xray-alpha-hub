-- Update SENA to ENAUSD as the primary symbol for Ethena Staked ENA
UPDATE ticker_mappings
SET symbol = 'ENAUSD',
    aliases = ARRAY['SENA']::text[]
WHERE symbol = 'SENA' AND coingecko_id = 'ethena-staked-ena';
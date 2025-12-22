
-- Apply 20 FIX coingecko_id mappings from user's manual research
UPDATE token_cards SET coingecko_id = 'matic-network' WHERE canonical_symbol = 'MATIC';
UPDATE token_cards SET coingecko_id = 'polygon-ecosystem-token' WHERE canonical_symbol = 'POL';
UPDATE token_cards SET coingecko_id = 'bob-token' WHERE canonical_symbol = 'BOB';
UPDATE token_cards SET coingecko_id = 'bluzelle' WHERE canonical_symbol = 'BLZ';
UPDATE token_cards SET coingecko_id = 'coinbase-wrapped-staked-eth' WHERE canonical_symbol = 'CBETH';
UPDATE token_cards SET coingecko_id = 'celer-network' WHERE canonical_symbol = 'CELR';
UPDATE token_cards SET coingecko_id = 'fuel-network' WHERE canonical_symbol = 'FUEL';
UPDATE token_cards SET coingecko_id = 'goldfinch' WHERE canonical_symbol = 'GFI';
UPDATE token_cards SET coingecko_id = 'jasmycoin' WHERE canonical_symbol = 'JASMY';
UPDATE token_cards SET coingecko_id = 'lido-dao' WHERE canonical_symbol = 'LDO';
UPDATE token_cards SET coingecko_id = 'moca-network' WHERE canonical_symbol = 'MOCA';
UPDATE token_cards SET coingecko_id = 'quant-network' WHERE canonical_symbol = 'QNT';
UPDATE token_cards SET coingecko_id = 'rocket-pool' WHERE canonical_symbol = 'RPL';
UPDATE token_cards SET coingecko_id = 'synthetix-network-token' WHERE canonical_symbol = 'SNX';
UPDATE token_cards SET coingecko_id = 'stellar' WHERE canonical_symbol = 'XLM';
UPDATE token_cards SET coingecko_id = 'ripple' WHERE canonical_symbol = 'XRP';
UPDATE token_cards SET coingecko_id = 'zircuit' WHERE canonical_symbol = 'ZRC';
UPDATE token_cards SET coingecko_id = 'flare-networks' WHERE canonical_symbol = 'FLR';
UPDATE token_cards SET coingecko_id = 'reserve-rights-token' WHERE canonical_symbol = 'RSR';
UPDATE token_cards SET coingecko_id = 'blur' WHERE canonical_symbol = 'BLUR';

-- Fix NGL to NTGL (Entangle)
UPDATE token_cards SET canonical_symbol = 'NTGL' WHERE canonical_symbol = 'NGL' AND name ILIKE '%entangle%';

-- Delete duplicate TPT3 (TPT already exists with correct ID)
DELETE FROM token_cards WHERE canonical_symbol = 'TPT3';

-- Deactivate defunct tokens
UPDATE token_cards SET is_active = false WHERE canonical_symbol = 'MIR';
UPDATE token_cards SET is_active = false WHERE canonical_symbol = 'BWB';

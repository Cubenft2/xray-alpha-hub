-- Mark BZR (Bazaars) as scam token due to suspicious $19B market cap with only $625K volume
UPDATE token_cards 
SET is_scam = true, 
    market_cap_rank = NULL,
    updated_at = now()
WHERE canonical_symbol = 'BZR';
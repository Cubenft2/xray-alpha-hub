-- Unblock SOLZILLA - data has been corrected (no longer showing fake $1.69T market cap)
UPDATE token_cards SET is_scam = false WHERE UPPER(canonical_symbol) = 'SOLZILLA';
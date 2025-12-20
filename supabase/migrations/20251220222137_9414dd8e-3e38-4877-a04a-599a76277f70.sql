-- Delete SOLZILLA and LILPEPE tokens - bad/manipulated data
DELETE FROM token_cards WHERE UPPER(canonical_symbol) IN ('SOLZILLA', 'LILPEPE');
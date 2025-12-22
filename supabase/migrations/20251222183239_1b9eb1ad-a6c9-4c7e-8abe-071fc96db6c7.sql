
-- Fix remaining issues
DELETE FROM token_cards WHERE canonical_symbol = 'TPT3';
UPDATE token_cards SET is_active = false WHERE canonical_symbol = 'BWB';

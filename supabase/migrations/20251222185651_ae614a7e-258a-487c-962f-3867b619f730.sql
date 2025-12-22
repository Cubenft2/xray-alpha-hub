
-- Delete TPT3 duplicate (correct TPT entry already exists)
DELETE FROM token_cards WHERE canonical_symbol = 'TPT3';

-- Deactivate BWB permanently
UPDATE token_cards SET is_active = false WHERE canonical_symbol = 'BWB';

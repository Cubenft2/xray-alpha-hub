-- Step 1: Update polygon_ticker for symbol mismatches
UPDATE token_cards SET polygon_ticker = 'X:SCROLLUSD' WHERE canonical_symbol = 'SCR';
UPDATE token_cards SET polygon_ticker = 'X:WAXUSD' WHERE canonical_symbol = 'WAXP';

-- Step 2: Enable polygon_supported for all tokens with valid polygon_ticker
UPDATE token_cards 
SET polygon_supported = true 
WHERE polygon_ticker IS NOT NULL 
  AND polygon_supported = false;

-- Step 3: Disable polygon_supported for defunct tokens
UPDATE token_cards 
SET polygon_supported = false 
WHERE canonical_symbol IN ('CEL', 'FTT', 'VGX', 'TRIBE', 'RGT', 'ZMT');
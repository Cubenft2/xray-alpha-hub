-- Add monad and monat aliases to MON in ticker_mappings
UPDATE public.ticker_mappings 
SET aliases = CASE 
  WHEN aliases IS NULL THEN ARRAY['monad', 'monat']
  WHEN NOT ('monad' = ANY(aliases)) AND NOT ('monat' = ANY(aliases)) THEN array_cat(aliases, ARRAY['monad', 'monat'])
  WHEN NOT ('monad' = ANY(aliases)) THEN array_append(aliases, 'monad')
  WHEN NOT ('monat' = ANY(aliases)) THEN array_append(aliases, 'monat')
  ELSE aliases
END,
updated_at = now()
WHERE symbol = 'MON' AND type = 'crypto';
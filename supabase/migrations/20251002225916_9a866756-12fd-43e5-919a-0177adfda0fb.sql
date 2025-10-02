-- Add norm_symbol function for consistent normalization
CREATE OR REPLACE FUNCTION public.norm_symbol(raw_symbol text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT UPPER(TRIM(REGEXP_REPLACE(raw_symbol, '[\s\-\.]', '_', 'g')))
$$;

-- Add new columns to pending_ticker_mappings if they don't exist
ALTER TABLE public.pending_ticker_mappings
ADD COLUMN IF NOT EXISTS seen_count integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS match_type text,
ADD COLUMN IF NOT EXISTS auto_approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS validation_notes text;

-- Update normalized_symbol to use norm_symbol function for existing data
UPDATE public.pending_ticker_mappings
SET normalized_symbol = public.norm_symbol(symbol)
WHERE normalized_symbol IS NULL OR normalized_symbol != public.norm_symbol(symbol);

-- Merge duplicate pending mappings before creating unique index
WITH duplicates AS (
  SELECT 
    normalized_symbol,
    array_agg(id ORDER BY created_at) as ids,
    MAX(confidence_score) as max_confidence,
    COUNT(*) as dup_count
  FROM pending_ticker_mappings
  WHERE status = 'pending'
  GROUP BY normalized_symbol
  HAVING COUNT(*) > 1
)
UPDATE pending_ticker_mappings p
SET 
  confidence_score = GREATEST(COALESCE(p.confidence_score, 0), d.max_confidence),
  seen_count = d.dup_count,
  updated_at = now()
FROM duplicates d
WHERE p.id = d.ids[1]
  AND p.normalized_symbol = d.normalized_symbol;

-- Delete duplicate records (keep only the first one)
WITH duplicates AS (
  SELECT 
    normalized_symbol,
    array_agg(id ORDER BY created_at) as ids
  FROM pending_ticker_mappings
  WHERE status = 'pending'
  GROUP BY normalized_symbol
  HAVING COUNT(*) > 1
)
DELETE FROM pending_ticker_mappings p
WHERE EXISTS (
  SELECT 1 FROM duplicates d
  WHERE p.normalized_symbol = d.normalized_symbol
    AND p.id = ANY(d.ids[2:])
);

-- Now create unique index on normalized_symbol for pending status
CREATE UNIQUE INDEX IF NOT EXISTS ux_pending_by_normalized 
ON public.pending_ticker_mappings(normalized_symbol) 
WHERE status = 'pending';

-- Add confidence calculation function
CREATE OR REPLACE FUNCTION public.calculate_confidence(
  p_match_type text,
  p_name_similarity numeric DEFAULT 0,
  p_has_alias boolean DEFAULT false,
  p_tv_validated boolean DEFAULT false
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  confidence numeric := 0;
BEGIN
  IF p_match_type = 'exact_symbol' THEN
    confidence := confidence + 0.70;
  END IF;
  
  IF p_name_similarity > 0 THEN
    confidence := confidence + (p_name_similarity * 0.15);
  END IF;
  
  IF p_has_alias THEN
    confidence := confidence + 0.10;
  END IF;
  
  IF p_tv_validated THEN
    confidence := confidence + 0.05;
  END IF;
  
  RETURN LEAST(confidence, 1.0);
END;
$$;

-- Add function to auto-approve high-confidence mappings
CREATE OR REPLACE FUNCTION public.auto_approve_pending_mappings()
RETURNS TABLE(approved_count integer, rejected_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_rec record;
  new_ticker_id uuid;
  v_approved_count integer := 0;
  v_rejected_count integer := 0;
BEGIN
  FOR pending_rec IN 
    SELECT * FROM pending_ticker_mappings
    WHERE status = 'pending'
      AND (
        (match_type = 'exact_symbol' AND confidence_score >= 0.90)
        OR (confidence_score >= 0.90 AND coingecko_id IS NOT NULL)
      )
      AND COALESCE(auto_approved, false) = false
  LOOP
    SELECT id INTO new_ticker_id
    FROM ticker_mappings
    WHERE symbol = pending_rec.normalized_symbol
      OR pending_rec.normalized_symbol = ANY(COALESCE(aliases, ARRAY[]::text[]));
    
    IF new_ticker_id IS NULL THEN
      INSERT INTO ticker_mappings (
        symbol,
        display_name,
        type,
        coingecko_id,
        tradingview_symbol,
        polygon_ticker,
        aliases,
        is_active
      ) VALUES (
        pending_rec.normalized_symbol,
        COALESCE(pending_rec.display_name, pending_rec.symbol),
        'crypto',
        pending_rec.coingecko_id,
        pending_rec.tradingview_symbol,
        pending_rec.polygon_ticker,
        CASE 
          WHEN pending_rec.symbol != pending_rec.normalized_symbol 
          THEN ARRAY[pending_rec.symbol]::text[]
          ELSE ARRAY[]::text[]
        END,
        true
      )
      RETURNING id INTO new_ticker_id;
    ELSE
      UPDATE ticker_mappings
      SET aliases = CASE 
                      WHEN pending_rec.symbol = symbol THEN aliases
                      WHEN pending_rec.symbol = ANY(COALESCE(aliases, ARRAY[]::text[])) THEN aliases
                      ELSE array_append(COALESCE(aliases, ARRAY[]::text[]), pending_rec.symbol)
                    END,
          updated_at = now()
      WHERE id = new_ticker_id;
    END IF;
    
    UPDATE pending_ticker_mappings
    SET status = 'approved',
        auto_approved = true,
        reviewed_at = now(),
        validation_notes = 'Auto-approved: ' || COALESCE(pending_rec.match_type, 'unknown') || ' with confidence ' || COALESCE(pending_rec.confidence_score, 0)
    WHERE id = pending_rec.id;
    
    v_approved_count := v_approved_count + 1;
  END LOOP;
  
  WITH rejected AS (
    UPDATE pending_ticker_mappings
    SET status = 'rejected',
        reviewed_at = now(),
        validation_notes = 'Auto-rejected: Low confidence with potential conflicts'
    WHERE status = 'pending'
      AND confidence_score <= 0.50
      AND EXISTS (
        SELECT 1 FROM ticker_mappings
        WHERE symbol = pending_ticker_mappings.normalized_symbol
          AND COALESCE(coingecko_id, '') != COALESCE(pending_ticker_mappings.coingecko_id, '')
          AND coingecko_id IS NOT NULL
          AND pending_ticker_mappings.coingecko_id IS NOT NULL
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_rejected_count FROM rejected;
  
  RETURN QUERY SELECT v_approved_count, v_rejected_count;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_pending_confidence ON pending_ticker_mappings(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_ticker_mappings(status);
CREATE INDEX IF NOT EXISTS idx_pending_match_type ON pending_ticker_mappings(match_type);
CREATE INDEX IF NOT EXISTS idx_pending_seen_count ON pending_ticker_mappings(seen_count DESC);
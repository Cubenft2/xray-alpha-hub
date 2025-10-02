-- Fix search_path for norm_symbol function
CREATE OR REPLACE FUNCTION public.norm_symbol(raw_symbol text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT UPPER(TRIM(REGEXP_REPLACE(raw_symbol, '[\s\-\.]', '_', 'g')))
$$;

-- Fix search_path for calculate_confidence function
CREATE OR REPLACE FUNCTION public.calculate_confidence(
  p_match_type text,
  p_name_similarity numeric DEFAULT 0,
  p_has_alias boolean DEFAULT false,
  p_tv_validated boolean DEFAULT false
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
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
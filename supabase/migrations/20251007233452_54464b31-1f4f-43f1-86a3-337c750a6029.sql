-- Fix IAS mapping and approve it
INSERT INTO public.ticker_mappings (
  symbol,
  display_name,
  type,
  tradingview_symbol,
  polygon_ticker,
  is_active,
  tradingview_supported,
  price_supported
) VALUES (
  'IAS',
  'Integral Ad Science',
  'stock',
  'NASDAQ:IAS',
  'IAS',
  true,
  true,
  true
)
ON CONFLICT (symbol) DO UPDATE SET
  type = 'stock',
  tradingview_symbol = 'NASDAQ:IAS',
  polygon_ticker = 'IAS',
  display_name = 'Integral Ad Science',
  is_active = true,
  updated_at = now();

-- Mark IAS as approved in pending_ticker_mappings
UPDATE public.pending_ticker_mappings
SET status = 'approved',
    reviewed_at = now(),
    validation_notes = 'Auto-approved: Stock from Polygon data'
WHERE normalized_symbol = 'IAS';

-- Batch approve all pending stocks with Polygon data
WITH pending_stocks AS (
  SELECT ptm.*
  FROM public.pending_ticker_mappings ptm
  INNER JOIN public.poly_tickers pt ON pt.ticker = ptm.polygon_ticker
  WHERE ptm.status = 'pending'
    AND pt.market = 'stocks'
    AND pt.active = true
    AND ptm.confidence_score >= 0.80
)
INSERT INTO public.ticker_mappings (
  symbol,
  display_name,
  type,
  tradingview_symbol,
  polygon_ticker,
  is_active,
  tradingview_supported,
  price_supported
)
SELECT 
  ps.normalized_symbol,
  COALESCE(ps.display_name, pt.name, ps.normalized_symbol),
  'stock',
  CASE 
    WHEN pt.primary_exchange ILIKE '%NASDAQ%' THEN 'NASDAQ:' || ps.normalized_symbol
    WHEN pt.primary_exchange ILIKE '%NYSE%' THEN 'NYSE:' || ps.normalized_symbol
    ELSE ps.normalized_symbol
  END,
  ps.polygon_ticker,
  true,
  true,
  true
FROM pending_stocks ps
INNER JOIN public.poly_tickers pt ON pt.ticker = ps.polygon_ticker
ON CONFLICT (symbol) DO UPDATE SET
  type = 'stock',
  polygon_ticker = EXCLUDED.polygon_ticker,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  updated_at = now();

-- Mark batch-approved stocks in pending table
UPDATE public.pending_ticker_mappings ptm
SET status = 'approved',
    auto_approved = true,
    reviewed_at = now(),
    validation_notes = 'Auto-approved: Stock from Polygon batch processing'
FROM public.poly_tickers pt
WHERE ptm.polygon_ticker = pt.ticker
  AND pt.market = 'stocks'
  AND pt.active = true
  AND ptm.status = 'pending'
  AND ptm.confidence_score >= 0.80;
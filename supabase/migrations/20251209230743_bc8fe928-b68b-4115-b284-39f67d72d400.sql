-- Fix: Recreate view without SECURITY DEFINER (use SECURITY INVOKER instead)
DROP VIEW IF EXISTS public.ticker_mappings_v2;

CREATE VIEW public.ticker_mappings_v2 
WITH (security_invoker = true) AS
SELECT 
  a.id,
  a.symbol,
  a.name AS display_name,
  a.type,
  a.logo_url,
  p.polygon_ticker,
  c.coingecko_id,
  tv.tradingview_symbol,
  tv.is_supported AS tradingview_supported,
  tc.contract_address AS dex_address,
  tc.chain AS dex_chain,
  lc.galaxy_score,
  lc.alt_rank,
  true AS is_active,
  a.created_at,
  a.updated_at
FROM public.assets a
LEFT JOIN public.polygon_assets p ON a.id = p.asset_id
LEFT JOIN public.coingecko_assets c ON a.id = c.asset_id
LEFT JOIN public.tradingview_assets tv ON a.id = tv.asset_id
LEFT JOIN public.token_contracts tc ON a.id = tc.asset_id AND tc.is_primary = true
LEFT JOIN public.lunarcrush_assets lc ON a.id = lc.asset_id;
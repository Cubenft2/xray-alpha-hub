-- Security cache table for GoPlus + DexScreener results (24h TTL)
CREATE TABLE IF NOT EXISTS public.security_cache (
  address text PRIMARY KEY,
  chain text,
  risk_level text,
  flags jsonb DEFAULT '[]'::jsonb,
  is_honeypot boolean DEFAULT false,
  liquidity jsonb DEFAULT '{}'::jsonb,
  contract_info jsonb DEFAULT '{}'::jsonb,
  source text DEFAULT 'goplus+dexscreener',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.security_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read security_cache" ON public.security_cache FOR SELECT USING (true);
CREATE POLICY "Service role write security_cache" ON public.security_cache FOR ALL USING (true);

-- Cache performance analytics view (daily aggregation)
CREATE OR REPLACE VIEW public.cache_perf_daily AS
SELECT
  date_trunc('day', created_at) as day,
  count(*) as requests,
  count(*) FILTER (WHERE data_sources_used IS NOT NULL AND array_length(data_sources_used, 1) > 0) as with_data_sources,
  avg(total_latency_ms) as avg_total_latency_ms
FROM public.ai_usage_logs
GROUP BY 1
ORDER BY 1 DESC;

-- API calls distribution view
CREATE OR REPLACE VIEW public.api_calls_daily AS
SELECT
  date_trunc('day', created_at) as day,
  unnest(data_sources_used) as api,
  count(*) as call_count
FROM public.ai_usage_logs
WHERE data_sources_used IS NOT NULL
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;
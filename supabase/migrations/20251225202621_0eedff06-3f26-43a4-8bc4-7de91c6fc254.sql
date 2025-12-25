-- Recreate api_calls_daily with security_invoker = true
CREATE OR REPLACE VIEW api_calls_daily 
WITH (security_invoker = true) AS
SELECT 
    date_trunc('day'::text, created_at) AS day,
    unnest(data_sources_used) AS api,
    count(*) AS call_count
FROM ai_usage_logs
WHERE data_sources_used IS NOT NULL
GROUP BY date_trunc('day'::text, created_at), unnest(data_sources_used)
ORDER BY date_trunc('day'::text, created_at) DESC, count(*) DESC;

-- Recreate cache_perf_daily with security_invoker = true
CREATE OR REPLACE VIEW cache_perf_daily 
WITH (security_invoker = true) AS
SELECT 
    date_trunc('day'::text, created_at) AS day,
    count(*) AS requests,
    count(*) FILTER (WHERE data_sources_used IS NOT NULL AND array_length(data_sources_used, 1) > 0) AS with_data_sources,
    avg(total_latency_ms) AS avg_total_latency_ms
FROM ai_usage_logs
GROUP BY date_trunc('day'::text, created_at)
ORDER BY date_trunc('day'::text, created_at) DESC;
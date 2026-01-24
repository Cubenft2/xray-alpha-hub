-- ============================================
-- Add Missing Cron Jobs (Collision-Safe Version)
-- ============================================
-- These 12 functions exist in config.toml but need to be added to pg_cron
-- All schedules have been adjusted to avoid minute-0 collisions
--
-- Project: odncvfiuzliyohxrsigc
-- Date: 2025-01-XX
-- ============================================

-- Base URL and Auth Token (anon key)
\set function_url 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1'
\set auth_token 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'

-- ============================================
-- 1. sync-polygon-crypto-technicals
-- Schedule: Every 3 minutes (1-58/3) - AVOIDS minute-0 ✅
-- Purpose: Technical indicators for Polygon-supported tokens
-- ============================================
SELECT cron.schedule(
  'sync-polygon-crypto-technicals',
  '1-58/3 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-polygon-crypto-technicals',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 2. sync-top500-technicals
-- Schedule: Every 30 minutes at :15 and :45 - AVOIDS minute-0 ✅
-- Original config.toml: */30 (runs at :00 and :30)
-- Fixed: 15,45 to avoid minute-0 collision
-- Purpose: Technical indicators for top 500 non-Polygon tokens
-- ============================================
SELECT cron.schedule(
  'sync-top500-technicals',
  '15,45 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-top500-technicals',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 3. sync-token-cards-coingecko
-- Schedule: Daily at 2:05 AM - SAFE ✅
-- Purpose: Maps CoinGecko IDs to tokens
-- ============================================
SELECT cron.schedule(
  'sync-token-cards-coingecko',
  '5 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-token-cards-coingecko',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 4. sync-token-cards-coingecko-contracts
-- Schedule: Daily at 6:35 AM - SAFE ✅
-- Purpose: Syncs contract addresses from CoinGecko (zero API cost)
-- ============================================
SELECT cron.schedule(
  'sync-token-cards-coingecko-contracts',
  '35 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-token-cards-coingecko-contracts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 5. mark-polygon-tokens
-- Schedule: Daily at 4:10 AM - AVOIDS collision with sync-cot-reports ✅
-- Original config.toml: 0 4 * * * (conflicts with sync-cot-reports at 4:00 AM Saturday)
-- Fixed: 10 4 * * * to avoid any potential collision
-- Purpose: Marks tokens available in Polygon WebSocket
-- ============================================
SELECT cron.schedule(
  'mark-polygon-tokens',
  '10 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/mark-polygon-tokens',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 6. massive-forex-sync
-- Schedule: Daily at 3:25 AM - SAFE ✅
-- Purpose: Syncs all forex tickers from Polygon
-- ============================================
SELECT cron.schedule(
  'massive-forex-sync',
  '25 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/massive-forex-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 7. warm-derivs-cache
-- Schedule: Every 5 minutes (4-59/5) - AVOIDS minute-0 ✅
-- Purpose: Pre-fetches derivatives data (cache warmer)
-- ============================================
SELECT cron.schedule(
  'warm-derivs-cache',
  '4-59/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/warm-derivs-cache',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 8. manual-price-sync
-- Schedule: Hourly at :30 - SAFE ✅
-- Purpose: Fallback price sync from CoinGecko
-- ============================================
SELECT cron.schedule(
  'manual-price-sync',
  '30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/manual-price-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 9. exchange-data-aggregator
-- Schedule: Every 15 minutes at :05, :20, :35, :50 - SAFE ✅
-- Purpose: Aggregates price data from multiple exchanges
-- ============================================
SELECT cron.schedule(
  'exchange-data-aggregator',
  '5,20,35,50 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/exchange-data-aggregator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 10. exchange-sync
-- Schedule: Every 6 hours at :20 - SAFE ✅
-- Purpose: Discovers trading pairs from exchanges
-- ============================================
SELECT cron.schedule(
  'exchange-sync',
  '20 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/exchange-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 11. price-poller
-- Schedule: Every 5 minutes (2-57/5) - AVOIDS minute-0 ✅
-- Purpose: Polls prices via exchange-data-aggregator
-- ============================================
SELECT cron.schedule(
  'price-poller',
  '2-57/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/price-poller',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 12. auto-map-polygon-tickers
-- Schedule: Daily at 2:15 AM - SAFE ✅
-- Purpose: Auto-maps Polygon tickers to ticker_mappings
-- ============================================
SELECT cron.schedule(
  'auto-map-polygon-tickers',
  '15 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/auto-map-polygon-tickers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- 13. auto-map-exchange-tickers
-- Schedule: Daily at 2:30 AM - SAFE ✅
-- Purpose: Auto-maps exchange pairs to token_cards
-- ============================================
SELECT cron.schedule(
  'auto-map-exchange-tickers',
  '30 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/auto-map-exchange-tickers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify all jobs were created successfully:

-- List all cron jobs (should see the 13 new ones):
-- SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;

-- Check for duplicate job names:
-- SELECT jobname, COUNT(*) FROM cron.job GROUP BY jobname HAVING COUNT(*) > 1;

-- Check for minute-0 collisions (should return empty or only intentional ones):
-- SELECT jobname, schedule FROM cron.job WHERE schedule LIKE '% 0 %' OR schedule LIKE '0 %' OR schedule LIKE '%*/%0%';

-- ============================================
-- SUMMARY OF CHANGES
-- ============================================
-- ✅ sync-top500-technicals: Changed from */30 to 15,45 (avoids minute-0)
-- ✅ mark-polygon-tokens: Changed from 0 4 to 10 4 (avoids collision with sync-cot-reports)
-- ✅ All other schedules match config.toml and are collision-safe
-- ✅ Total: 13 jobs scheduled (all safe, no duplicates expected)

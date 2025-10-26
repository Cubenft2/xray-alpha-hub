-- Create quote population history table
CREATE TABLE IF NOT EXISTS public.quote_population_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by TEXT NOT NULL,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  quotes_fetched INTEGER DEFAULT 0,
  quotes_inserted INTEGER DEFAULT 0,
  duplicates_skipped INTEGER DEFAULT 0,
  categories_processed JSONB DEFAULT '[]'::jsonb,
  errors JSONB DEFAULT '[]'::jsonb,
  duration_ms INTEGER,
  success BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.quote_population_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow service role full access to quote_population_history"
  ON public.quote_population_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read access to quote_population_history"
  ON public.quote_population_history
  FOR SELECT
  USING (true);

-- Schedule quote library population twice daily
-- Morning: 6:00 AM UTC (before morning brief generation)
SELECT cron.schedule(
  'populate-quotes-morning',
  '0 6 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/populate-quotes-library',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
        body:='{"trigger": "cron_morning"}'::jsonb
    ) as request_id;
  $$
);

-- Evening: 6:00 PM UTC (before evening brief generation)
SELECT cron.schedule(
  'populate-quotes-evening',
  '0 18 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/populate-quotes-library',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
        body:='{"trigger": "cron_evening"}'::jsonb
    ) as request_id;
  $$
);
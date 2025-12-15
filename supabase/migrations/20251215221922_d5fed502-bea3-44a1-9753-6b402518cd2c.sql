-- Create external_api_calls table for tracking all external API calls
CREATE TABLE public.external_api_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name text NOT NULL,
  function_name text NOT NULL,
  call_count integer DEFAULT 1,
  success boolean DEFAULT true,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Index for efficient daily aggregation queries
CREATE INDEX idx_external_api_calls_api_day ON external_api_calls (api_name, created_at DESC);
CREATE INDEX idx_external_api_calls_function ON external_api_calls (function_name, created_at DESC);

-- Enable RLS
ALTER TABLE public.external_api_calls ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow public read access to external_api_calls" ON external_api_calls FOR SELECT USING (true);
CREATE POLICY "Service role full access to external_api_calls" ON external_api_calls FOR ALL USING (true) WITH CHECK (true);

-- Create api_rate_limits configuration table
CREATE TABLE public.api_rate_limits (
  api_name text PRIMARY KEY,
  daily_limit integer NOT NULL,
  warning_threshold numeric DEFAULT 0.8,
  critical_threshold numeric DEFAULT 0.95,
  description text,
  reset_hour integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow public read access to api_rate_limits" ON api_rate_limits FOR SELECT USING (true);
CREATE POLICY "Service role full access to api_rate_limits" ON api_rate_limits FOR ALL USING (true) WITH CHECK (true);

-- Insert known API limits
INSERT INTO api_rate_limits (api_name, daily_limit, description) VALUES
  ('lunarcrush', 2000, 'LunarCrush API v4 - social metrics'),
  ('coingecko', 500, 'CoinGecko Pro API - metadata'),
  ('tavily', 1000, 'Tavily Web Search - news queries'),
  ('coinglass', 1000, 'CoinGlass - derivatives data');
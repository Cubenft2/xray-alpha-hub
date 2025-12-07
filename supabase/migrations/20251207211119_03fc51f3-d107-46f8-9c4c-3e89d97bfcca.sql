-- Create AI usage logs table for ZombieDog analytics
CREATE TABLE public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Provider tracking
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  
  -- Token metrics
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  
  -- Cost calculation (in USD millicents for precision)
  estimated_cost_millicents INTEGER NOT NULL DEFAULT 0,
  
  -- Context metadata
  session_id TEXT,
  question_type TEXT[],
  assets_queried TEXT[],
  data_sources_used TEXT[],
  
  -- Performance
  latency_ms INTEGER,
  fallback_used BOOLEAN DEFAULT false,
  fallback_from TEXT,
  
  -- User message preview (first 200 chars for debugging)
  user_message_preview TEXT
);

-- Indexes for efficient queries
CREATE INDEX idx_ai_usage_created ON public.ai_usage_logs(created_at DESC);
CREATE INDEX idx_ai_usage_provider ON public.ai_usage_logs(provider);

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Deny public access to ai_usage_logs"
ON public.ai_usage_logs
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny authenticated access to ai_usage_logs"
ON public.ai_usage_logs
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Service role full access to ai_usage_logs"
ON public.ai_usage_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
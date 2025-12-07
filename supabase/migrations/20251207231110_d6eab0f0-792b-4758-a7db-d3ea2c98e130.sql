-- Add client_ip column to ai_usage_logs for rate limiting
ALTER TABLE public.ai_usage_logs 
ADD COLUMN IF NOT EXISTS client_ip text;

-- Create index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_rate_limit 
ON public.ai_usage_logs (client_ip, created_at DESC);
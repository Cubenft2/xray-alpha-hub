-- Create data_quality_alerts table for automated monitoring
CREATE TABLE public.data_quality_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  function_name TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying unresolved alerts
CREATE INDEX idx_data_quality_alerts_unresolved ON public.data_quality_alerts(resolved, severity, created_at DESC);

-- Enable RLS
ALTER TABLE public.data_quality_alerts ENABLE ROW LEVEL SECURITY;

-- Public read for admin dashboard
CREATE POLICY "Allow public read access to data_quality_alerts"
ON public.data_quality_alerts FOR SELECT
USING (true);

-- Service role write
CREATE POLICY "Service role full access to data_quality_alerts"
ON public.data_quality_alerts FOR ALL
USING (true)
WITH CHECK (true);
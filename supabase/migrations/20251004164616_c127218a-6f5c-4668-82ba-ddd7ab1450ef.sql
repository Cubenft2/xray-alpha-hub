-- Create site_settings table for ticker configuration
CREATE TABLE IF NOT EXISTS public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to site_settings"
  ON public.site_settings
  FOR SELECT
  TO public
  USING (true);

-- Allow service role full access
CREATE POLICY "Service role full access to site_settings"
  ON public.site_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert default ticker configuration
INSERT INTO public.site_settings (setting_key, setting_value) 
VALUES (
  'ticker_list',
  '[
    {"ticker": "X:BTCUSD", "display": "BTC", "type": "crypto", "precision": 2, "enabled": true, "position": 1},
    {"ticker": "X:ETHUSD", "display": "ETH", "type": "crypto", "precision": 2, "enabled": true, "position": 2},
    {"ticker": "X:SOLUSD", "display": "SOL", "type": "crypto", "precision": 2, "enabled": true, "position": 3},
    {"ticker": "C:EURUSD", "display": "EUR/USD", "type": "fx", "precision": 4, "enabled": true, "position": 4},
    {"ticker": "X:ADAUSD", "display": "ADA", "type": "crypto", "precision": 4, "enabled": true, "position": 5},
    {"ticker": "X:XRPUSD", "display": "XRP", "type": "crypto", "precision": 4, "enabled": true, "position": 6}
  ]'::jsonb
)
ON CONFLICT (setting_key) DO NOTHING;

-- Create updated_at trigger
CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
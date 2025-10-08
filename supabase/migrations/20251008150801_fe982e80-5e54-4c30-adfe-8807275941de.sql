-- Create price_history table for storing historical OHLC data
CREATE TABLE IF NOT EXISTS public.price_history (
  ticker TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume NUMERIC NOT NULL,
  timeframe TEXT NOT NULL, -- '1min', '5min', '1hour', '1day'
  asset_type TEXT NOT NULL, -- 'crypto' or 'stock'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, timestamp, timeframe)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_price_history_ticker_timeframe ON public.price_history(ticker, timeframe, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON public.price_history(timestamp DESC);

-- Enable RLS
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to price_history"
  ON public.price_history
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow service role full access to price_history"
  ON public.price_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_price_history_updated_at
  BEFORE UPDATE ON public.price_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create technical_indicators table
CREATE TABLE IF NOT EXISTS public.technical_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  indicator_type TEXT NOT NULL, -- 'rsi', 'macd', 'sma', 'ema'
  value JSONB NOT NULL, -- Flexible storage for different indicator structures
  timeframe TEXT NOT NULL DEFAULT 'daily', -- 'daily', 'hourly'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour')
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_technical_indicators_ticker ON public.technical_indicators(ticker, indicator_type, timeframe);
CREATE INDEX IF NOT EXISTS idx_technical_indicators_expires ON public.technical_indicators(expires_at);
CREATE INDEX IF NOT EXISTS idx_technical_indicators_timestamp ON public.technical_indicators(timestamp DESC);

-- Enable RLS
ALTER TABLE public.technical_indicators ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to technical_indicators"
  ON public.technical_indicators
  FOR SELECT
  TO public
  USING (expires_at > now());

CREATE POLICY "Allow service role full access to technical_indicators"
  ON public.technical_indicators
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.price_history IS 'Stores historical OHLC price data from Polygon.io';
COMMENT ON TABLE public.technical_indicators IS 'Stores technical indicators (RSI, MACD, SMA, EMA) from Polygon.io';
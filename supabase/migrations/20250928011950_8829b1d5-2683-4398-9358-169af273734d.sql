-- Create comprehensive market briefs system
CREATE TABLE public.market_briefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brief_type VARCHAR(20) NOT NULL CHECK (brief_type IN ('premarket', 'postmarket', 'weekend', 'special')),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  executive_summary TEXT NOT NULL,
  content_sections JSONB NOT NULL DEFAULT '{}',
  social_data JSONB DEFAULT '{}',
  market_data JSONB DEFAULT '{}',
  stoic_quote TEXT,
  featured_assets TEXT[] DEFAULT '{}',
  sentiment_score DECIMAL(5,2),
  view_count INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create social sentiment tracking
CREATE TABLE public.social_sentiment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_symbol TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  sentiment_score DECIMAL(5,2) NOT NULL,
  social_volume INTEGER DEFAULT 0,
  social_volume_24h_change DECIMAL(10,2),
  galaxy_score DECIMAL(10,2),
  trending_rank INTEGER,
  top_influencers JSONB DEFAULT '[]',
  viral_posts JSONB DEFAULT '[]',
  data_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create market alerts system
CREATE TABLE public.market_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN ('social_spike', 'sentiment_shift', 'volume_anomaly', 'price_social_divergence')),
  asset_symbol TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  trigger_value DECIMAL(15,8),
  current_value DECIMAL(15,8),
  alert_message TEXT NOT NULL,
  severity VARCHAR(10) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_active BOOLEAN DEFAULT true,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create earnings tracking for crypto-related stocks
CREATE TABLE public.earnings_calendar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_symbol TEXT NOT NULL,
  company_name TEXT NOT NULL,
  earnings_date DATE NOT NULL,
  earnings_time VARCHAR(20) CHECK (earnings_time IN ('BMO', 'AMC', 'TBD')),
  is_crypto_related BOOLEAN DEFAULT false,
  category TEXT, -- 'tech', 'ai', 'crypto', 'major'
  expected_eps DECIMAL(10,4),
  social_sentiment DECIMAL(5,2),
  importance_score INTEGER CHECK (importance_score BETWEEN 1 AND 10),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.market_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_sentiment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings_calendar ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (since this is market data)
CREATE POLICY "Allow public read access to published briefs" 
ON public.market_briefs 
FOR SELECT 
USING (is_published = true);

CREATE POLICY "Allow public read access to social sentiment" 
ON public.social_sentiment 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public read access to active market alerts" 
ON public.market_alerts 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Allow public read access to earnings calendar" 
ON public.earnings_calendar 
FOR SELECT 
USING (true);

-- Create service role policies for data insertion
CREATE POLICY "Allow service role full access to market_briefs" 
ON public.market_briefs 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow service role full access to social_sentiment" 
ON public.social_sentiment 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow service role full access to market_alerts" 
ON public.market_alerts 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow service role full access to earnings_calendar" 
ON public.earnings_calendar 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_market_briefs_type_published 
ON public.market_briefs(brief_type, is_published, published_at DESC);

CREATE INDEX idx_social_sentiment_symbol_timestamp 
ON public.social_sentiment(asset_symbol, data_timestamp DESC);

CREATE INDEX idx_market_alerts_active_severity 
ON public.market_alerts(is_active, severity, created_at DESC);

CREATE INDEX idx_earnings_calendar_date_crypto 
ON public.earnings_calendar(earnings_date, is_crypto_related);

-- Create update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_market_briefs_updated_at
BEFORE UPDATE ON public.market_briefs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_earnings_calendar_updated_at
BEFORE UPDATE ON public.earnings_calendar
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
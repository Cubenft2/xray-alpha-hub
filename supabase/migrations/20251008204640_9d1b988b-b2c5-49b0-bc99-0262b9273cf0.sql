-- Create asset_sentiment_snapshots table
CREATE TABLE asset_sentiment_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  
  -- Asset identification
  asset_symbol text NOT NULL,
  asset_name text NOT NULL,
  asset_type text,
  
  -- Sentiment metrics
  sentiment_score numeric NOT NULL,
  sentiment_label text NOT NULL,
  positive_count integer NOT NULL DEFAULT 0,
  negative_count integer NOT NULL DEFAULT 0,
  neutral_count integer NOT NULL DEFAULT 0,
  total_articles integer NOT NULL DEFAULT 0,
  
  -- Trend tracking
  trend_direction text,
  score_change numeric,
  
  -- Metadata
  polygon_articles_count integer DEFAULT 0,
  top_keywords text[],
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(timestamp, asset_symbol)
);

-- Create indexes for performance
CREATE INDEX idx_asset_sentiment_timestamp ON asset_sentiment_snapshots(timestamp DESC);
CREATE INDEX idx_asset_sentiment_symbol ON asset_sentiment_snapshots(asset_symbol);
CREATE INDEX idx_asset_sentiment_score ON asset_sentiment_snapshots(sentiment_score DESC);

-- Enable Row Level Security
ALTER TABLE asset_sentiment_snapshots ENABLE ROW LEVEL SECURITY;

-- Public read access for live display
CREATE POLICY "Allow public read access to asset_sentiment_snapshots"
  ON asset_sentiment_snapshots FOR SELECT
  USING (true);

-- Service role full access
CREATE POLICY "Service role full access to asset_sentiment_snapshots"
  ON asset_sentiment_snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Enable realtime
ALTER TABLE asset_sentiment_snapshots REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE asset_sentiment_snapshots;

-- Cleanup function for old snapshots
CREATE OR REPLACE FUNCTION cleanup_old_asset_sentiments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM asset_sentiment_snapshots
  WHERE timestamp < now() - interval '24 hours';
END;
$$;
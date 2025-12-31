-- Create trending_topics table for LunarCrush Topics API data
CREATE TABLE trending_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core topic data
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  
  -- Category derived from topic prefix
  category TEXT CHECK (category IN (
    'crypto_narrative',
    'stock_sector',
    'ticker',
    'general'
  )),
  
  -- Rankings
  topic_rank INTEGER NOT NULL,
  rank_1h_ago INTEGER,
  rank_24h_ago INTEGER,
  
  -- Momentum (computed - positive = rising, negative = falling)
  momentum_1h INTEGER GENERATED ALWAYS AS (COALESCE(rank_1h_ago, topic_rank) - topic_rank) STORED,
  momentum_24h INTEGER GENERATED ALWAYS AS (COALESCE(rank_24h_ago, topic_rank) - topic_rank) STORED,
  
  -- Engagement metrics
  num_contributors INTEGER,
  num_posts INTEGER,
  interactions_24h BIGINT,
  
  -- Timestamps
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent duplicate snapshots
  UNIQUE(topic, snapshot_at)
);

-- Indexes for efficient queries
CREATE INDEX idx_trending_topics_snapshot ON trending_topics(snapshot_at DESC);
CREATE INDEX idx_trending_topics_category_rank ON trending_topics(category, topic_rank);
CREATE INDEX idx_trending_topics_momentum ON trending_topics(momentum_1h DESC);
CREATE INDEX idx_trending_topics_topic ON trending_topics(topic);

-- RLS Policies
ALTER TABLE trending_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to trending_topics" 
ON trending_topics FOR SELECT USING (true);

CREATE POLICY "Service role full access to trending_topics" 
ON trending_topics FOR ALL USING (true) WITH CHECK (true);
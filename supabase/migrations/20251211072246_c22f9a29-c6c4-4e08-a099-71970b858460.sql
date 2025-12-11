-- Remove duplicate tickers keeping only the most recently updated one
DELETE FROM crypto_snapshot a 
USING crypto_snapshot b 
WHERE a.ticker = b.ticker 
  AND a.updated_at < b.updated_at;

-- Now add unique constraint on ticker column for crypto_snapshot upserts  
ALTER TABLE crypto_snapshot ADD CONSTRAINT crypto_snapshot_ticker_unique UNIQUE (ticker);
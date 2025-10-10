-- Fix exchange_ticker_data table issues

-- Drop the problematic trigger first
DROP TRIGGER IF EXISTS update_exchange_ticker_data_updated_at ON exchange_ticker_data;

-- Add missing updated_at column
ALTER TABLE exchange_ticker_data
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Make some columns nullable (exchanges might not provide all data)
ALTER TABLE exchange_ticker_data
ALTER COLUMN change_24h DROP NOT NULL,
ALTER COLUMN high_24h DROP NOT NULL,
ALTER COLUMN low_24h DROP NOT NULL;

-- Add unique constraint for upserts
ALTER TABLE exchange_ticker_data
ADD CONSTRAINT exchange_ticker_data_unique 
UNIQUE (asset_symbol, exchange);

-- Recreate the trigger properly
CREATE TRIGGER update_exchange_ticker_data_updated_at
BEFORE UPDATE ON exchange_ticker_data
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create index on updated_at for performance
CREATE INDEX IF NOT EXISTS idx_exchange_ticker_data_updated_at 
ON exchange_ticker_data(updated_at DESC);
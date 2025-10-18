-- Update existing briefs to be published
UPDATE market_briefs 
SET is_published = true 
WHERE is_published IS NULL OR is_published = false;
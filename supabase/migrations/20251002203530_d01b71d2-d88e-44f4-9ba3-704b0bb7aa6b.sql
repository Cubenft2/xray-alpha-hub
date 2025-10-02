-- Drop existing constraint on market_briefs.brief_type
ALTER TABLE market_briefs 
DROP CONSTRAINT IF EXISTS market_briefs_brief_type_check;

-- Add new constraint allowing all brief types (existing + new)
ALTER TABLE market_briefs
ADD CONSTRAINT market_briefs_brief_type_check 
CHECK (brief_type IN ('morning', 'afternoon', 'evening', 'premarket', 'postmarket', 'weekend', 'weekly'));
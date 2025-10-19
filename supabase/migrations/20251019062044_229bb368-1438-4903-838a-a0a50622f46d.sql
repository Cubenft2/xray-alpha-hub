-- Add sunday_special as a valid brief_type (include all existing types)
ALTER TABLE market_briefs
DROP CONSTRAINT IF EXISTS market_briefs_brief_type_check;

ALTER TABLE market_briefs
ADD CONSTRAINT market_briefs_brief_type_check 
CHECK (brief_type IN ('morning', 'evening', 'weekend', 'premarket', 'postmarket', 'sunday_special'));
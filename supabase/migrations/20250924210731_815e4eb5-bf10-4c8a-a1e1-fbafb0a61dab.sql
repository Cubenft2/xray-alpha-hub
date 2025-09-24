-- Add columns to market_briefs table to match the data structure
ALTER TABLE public.market_briefs 
ADD COLUMN slug TEXT,
ADD COLUMN date TEXT,
ADD COLUMN title TEXT,
ADD COLUMN summary TEXT,
ADD COLUMN article_html TEXT,
ADD COLUMN author TEXT,
ADD COLUMN canonical TEXT;

-- Add index on slug for faster lookups
CREATE INDEX idx_market_briefs_slug ON public.market_briefs(slug);

-- Add index on date for chronological queries
CREATE INDEX idx_market_briefs_date ON public.market_briefs(date);

-- Add unique constraint on slug to prevent duplicates
ALTER TABLE public.market_briefs ADD CONSTRAINT unique_market_briefs_slug UNIQUE (slug);
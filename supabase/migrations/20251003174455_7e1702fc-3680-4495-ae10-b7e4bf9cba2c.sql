-- Create quote library table for fallback quotes
CREATE TABLE public.quote_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_text TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  times_used INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add constraint to ensure quotes are under 200 characters
ALTER TABLE public.quote_library 
  ADD CONSTRAINT quote_text_length CHECK (char_length(quote_text) <= 200);

-- Create index for active quotes
CREATE INDEX idx_quote_library_active ON public.quote_library(is_active, last_used_at);

-- Create daily quotes tracking table
CREATE TABLE public.daily_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brief_id UUID REFERENCES public.market_briefs(id) ON DELETE CASCADE,
  quote_text TEXT NOT NULL,
  author TEXT NOT NULL,
  source TEXT NOT NULL, -- 'api_ninjas', 'fallback_library', 'manual_override'
  used_date DATE NOT NULL,
  brief_type VARCHAR NOT NULL, -- 'morning', 'evening', 'weekend'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for quote history lookups
CREATE INDEX idx_daily_quotes_used_date ON public.daily_quotes(used_date DESC);
CREATE INDEX idx_daily_quotes_brief_type ON public.daily_quotes(brief_type, used_date DESC);

-- Enable RLS on both tables
ALTER TABLE public.quote_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_quotes ENABLE ROW LEVEL SECURITY;

-- Allow public read access to quote library
CREATE POLICY "Allow public read access to active quotes"
  ON public.quote_library
  FOR SELECT
  USING (is_active = true);

-- Allow service role full access to quote library
CREATE POLICY "Allow service role full access to quote_library"
  ON public.quote_library
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Allow public read access to daily quotes
CREATE POLICY "Allow public read access to daily_quotes"
  ON public.daily_quotes
  FOR SELECT
  USING (true);

-- Allow service role full access to daily quotes
CREATE POLICY "Allow service role full access to daily_quotes"
  ON public.daily_quotes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Seed quote library with initial fallback quotes
INSERT INTO public.quote_library (quote_text, author, category) VALUES
  ('The only way to do great work is to love what you do.', 'Steve Jobs', 'business'),
  ('In the middle of difficulty lies opportunity.', 'Albert Einstein', 'philosophy'),
  ('The market is a device for transferring money from the impatient to the patient.', 'Warren Buffett', 'investing'),
  ('Risk comes from not knowing what you''re doing.', 'Warren Buffett', 'investing'),
  ('The best time to plant a tree was 20 years ago. The second best time is now.', 'Chinese Proverb', 'wisdom'),
  ('Success is not final, failure is not fatal: it is the courage to continue that counts.', 'Winston Churchill', 'motivation'),
  ('The only impossible journey is the one you never begin.', 'Tony Robbins', 'motivation'),
  ('It is not the strongest of the species that survives, but the one most adaptable to change.', 'Charles Darwin', 'science'),
  ('Innovation distinguishes between a leader and a follower.', 'Steve Jobs', 'business'),
  ('The function of wisdom is to discriminate between good and evil.', 'Marcus Tullius Cicero', 'philosophy'),
  ('We cannot solve our problems with the same thinking we used when we created them.', 'Albert Einstein', 'philosophy'),
  ('The wise man bridges the gap by laying out the path by means of which he can get from where he is to where he wants to go.', 'J.P. Morgan', 'investing'),
  ('Price is what you pay. Value is what you get.', 'Warren Buffett', 'investing'),
  ('The stock market is filled with individuals who know the price of everything, but the value of nothing.', 'Philip Fisher', 'investing'),
  ('Courage is not the absence of fear, but rather the judgment that something else is more important than fear.', 'Ambrose Redmoon', 'motivation'),
  ('What we think, we become.', 'Buddha', 'philosophy'),
  ('Life is 10% what happens to you and 90% how you react to it.', 'Charles R. Swindoll', 'wisdom'),
  ('The only true wisdom is in knowing you know nothing.', 'Socrates', 'philosophy'),
  ('He who has a why to live can bear almost any how.', 'Friedrich Nietzsche', 'philosophy'),
  ('The unexamined life is not worth living.', 'Socrates', 'philosophy'),
  ('To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.', 'Ralph Waldo Emerson', 'philosophy'),
  ('The mind is everything. What you think you become.', 'Buddha', 'philosophy'),
  ('In investing, what is comfortable is rarely profitable.', 'Robert Arnott', 'investing'),
  ('The four most dangerous words in investing are: this time it''s different.', 'Sir John Templeton', 'investing'),
  ('An investment in knowledge pays the best interest.', 'Benjamin Franklin', 'wisdom'),
  ('Do not go where the path may lead, go instead where there is no path and leave a trail.', 'Ralph Waldo Emerson', 'motivation'),
  ('The best revenge is massive success.', 'Frank Sinatra', 'motivation'),
  ('I have not failed. I''ve just found 10,000 ways that won''t work.', 'Thomas Edison', 'science'),
  ('Genius is one percent inspiration and ninety-nine percent perspiration.', 'Thomas Edison', 'science'),
  ('The greatest glory in living lies not in never falling, but in rising every time we fall.', 'Nelson Mandela', 'motivation');
-- Add last_resolved_asset column for follow-up binding
ALTER TABLE public.chat_summaries 
ADD COLUMN IF NOT EXISTS last_resolved_asset text NULL;
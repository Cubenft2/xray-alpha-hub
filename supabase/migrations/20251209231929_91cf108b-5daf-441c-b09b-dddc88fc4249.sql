-- Drop and recreate the type check constraint to include all asset types
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_type_check;

ALTER TABLE public.assets ADD CONSTRAINT assets_type_check 
CHECK (type IN ('crypto', 'stock', 'forex', 'dex', 'index'));
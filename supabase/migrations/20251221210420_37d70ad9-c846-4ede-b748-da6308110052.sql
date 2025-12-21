-- Create enum for flag categories
CREATE TYPE public.token_flag_category AS ENUM ('needs_work', 'remove', 'review', 'suspicious', 'duplicate', 'missing_data');

-- Create token_flags table
CREATE TABLE public.token_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  category token_flag_category NOT NULL,
  notes text,
  flagged_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(symbol, category)
);

-- Enable RLS
ALTER TABLE public.token_flags ENABLE ROW LEVEL SECURITY;

-- Only admins can view flags
CREATE POLICY "Admins can view all token flags"
ON public.token_flags
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can create flags
CREATE POLICY "Admins can create token flags"
ON public.token_flags
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update flags
CREATE POLICY "Admins can update token flags"
ON public.token_flags
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete flags
CREATE POLICY "Admins can delete token flags"
ON public.token_flags
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create index for quick lookups
CREATE INDEX idx_token_flags_symbol ON public.token_flags(symbol);
CREATE INDEX idx_token_flags_category ON public.token_flags(category);
CREATE INDEX idx_token_flags_unresolved ON public.token_flags(symbol) WHERE resolved_at IS NULL;
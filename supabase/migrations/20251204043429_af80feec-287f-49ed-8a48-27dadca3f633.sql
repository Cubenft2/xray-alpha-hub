-- Create storage bucket for OG images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'og-images', 
  'og-images', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to OG images
CREATE POLICY "Public read access for OG images"
ON storage.objects FOR SELECT
USING (bucket_id = 'og-images');

-- Allow service role to upload OG images
CREATE POLICY "Service role can upload OG images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'og-images');

-- Allow service role to update OG images
CREATE POLICY "Service role can update OG images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'og-images');
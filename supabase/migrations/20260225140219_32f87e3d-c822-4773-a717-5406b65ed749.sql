
-- Add icon_name column to groups (Lucide icon name)
ALTER TABLE public.groups ADD COLUMN icon_name text;

-- Create storage bucket for word images
INSERT INTO storage.buckets (id, name, public) VALUES ('word-images', 'word-images', true);

-- Allow authenticated users to upload to word-images bucket
CREATE POLICY "Authenticated users can upload word images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'word-images' AND auth.uid() IS NOT NULL);

-- Allow public read access
CREATE POLICY "Word images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'word-images');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own word images"
ON storage.objects FOR DELETE
USING (bucket_id = 'word-images' AND auth.uid() IS NOT NULL);

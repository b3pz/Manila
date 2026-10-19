-- Eseguire nel SQL Editor Supabase come postgres, una sola volta.
alter table public.manila_products add column if not exists video_url text;
update storage.buckets set file_size_limit=20971520,
 allowed_mime_types=array['image/jpeg','image/png','image/webp','video/mp4']
 where id='manila-products';

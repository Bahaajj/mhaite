-- Run in Supabase SQL Editor after reviewing your current schema/policies.
-- This adds the fields required by the news image/category feature.
alter table public.public_news add column if not exists category text not null default 'general';
alter table public.public_news add column if not exists image_url text;

-- Public visitors can read published news. If you already have a SELECT policy, inspect it first.
alter table public.public_news enable row level security;
create policy "Public can read municipality news"
  on public.public_news for select
  to anon, authenticated
  using (true);

-- Authenticated staff can publish/delete news. IMPORTANT: tighten this to your staff/admin role
-- before real production use; this generic policy permits any signed-in account.
create policy "Authenticated users can publish municipality news"
  on public.public_news for insert
  to authenticated
  with check (auth.uid() = created_by);
create policy "Authenticated users can delete municipality news"
  on public.public_news for delete
  to authenticated
  using (auth.uid() is not null);

-- Create these two Storage buckets in Supabase Dashboard > Storage if they do not exist:
-- 1) public-news-images: PUBLIC bucket (public image URLs used on the news page)
-- 2) municipality-submissions: PRIVATE bucket (citizen documents; admin creates short-lived signed links)
-- Bucket creation is done in Dashboard, not by this SQL script.

-- Public can view the public news images.
create policy "Public can view municipality news images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'public-news-images');
create policy "Signed-in users can upload municipality news images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'public-news-images' and auth.uid() is not null);
create policy "Signed-in users can delete municipality news images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'public-news-images' and auth.uid() is not null);

-- The citizen upload helper requires an INSERT policy for anonymous visitors to upload documents.
-- This allows uploads only into the specified private bucket; configure bucket file-size/MIME limits
-- in Storage settings and add rate limiting/anti-abuse protections before public production use.
create policy "Visitors can upload citizen submission attachments"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'municipality-submissions');

-- Admin dashboard needs authenticated staff to create short-lived links for private attachments.
create policy "Signed-in staff can read citizen submission attachments"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'municipality-submissions');

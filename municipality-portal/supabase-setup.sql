-- Run this in Supabase SQL Editor after creating a new project.
-- After creating an employee in Authentication > Users, copy that user's UUID
-- and insert it into public.admin_users (example below, replace the UUID).
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_municipality_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admin_users where user_id = auth.uid()); $$;
revoke all on function public.is_municipality_admin() from public;
grant execute on function public.is_municipality_admin() to anon, authenticated;

create table if not exists public.citizen_submissions (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique default ('MUN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  kind text not null check (kind in ('request','complaint')),
  full_name text not null check (char_length(full_name) between 2 and 150),
  phone text not null check (char_length(phone) between 3 and 30),
  email text,
  request_type text,
  complaint_type text,
  details text not null check (char_length(details) between 2 and 4000),
  location text,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new','in_progress','need_info','completed','rejected')),
  created_at timestamptz not null default now(),
  check ((kind = 'request' and request_type is not null) or (kind = 'complaint' and complaint_type is not null))
);

create table if not exists public.citizen_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  email text,
  phone text,
  message text not null check (char_length(message) between 2 and 3000),
  created_at timestamptz not null default now()
);

create table if not exists public.public_news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 180),
  summary text not null check (char_length(summary) between 2 and 3000),
  published_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.admin_users enable row level security;
alter table public.citizen_submissions enable row level security;
alter table public.citizen_messages enable row level security;
alter table public.public_news enable row level security;

-- Public can submit, but cannot read any citizen's personal information.
drop policy if exists "Public submit citizen forms" on public.citizen_submissions;
create policy "Public submit citizen forms" on public.citizen_submissions for insert to anon, authenticated with check (true);
drop policy if exists "Admins read submissions" on public.citizen_submissions;
create policy "Admins read submissions" on public.citizen_submissions for select to authenticated using (public.is_municipality_admin());
drop policy if exists "Admins update submissions" on public.citizen_submissions;
create policy "Admins update submissions" on public.citizen_submissions for update to authenticated using (public.is_municipality_admin()) with check (public.is_municipality_admin());

-- Contact messages are insert-only for visitors.
drop policy if exists "Public submit contact messages" on public.citizen_messages;
create policy "Public submit contact messages" on public.citizen_messages for insert to anon, authenticated with check (true);
drop policy if exists "Admins read contact messages" on public.citizen_messages;
create policy "Admins read contact messages" on public.citizen_messages for select to authenticated using (public.is_municipality_admin());

-- News is public to read; only explicitly listed municipality admins can publish.
drop policy if exists "Anyone can read news" on public.public_news;
create policy "Anyone can read news" on public.public_news for select to anon, authenticated using (true);
drop policy if exists "Admins publish news" on public.public_news;
create policy "Admins publish news" on public.public_news for insert to authenticated with check (public.is_municipality_admin() and created_by = auth.uid());
drop policy if exists "Admins update news" on public.public_news;
create policy "Admins update news" on public.public_news for update to authenticated using (public.is_municipality_admin()) with check (public.is_municipality_admin());
drop policy if exists "Admins delete news" on public.public_news;
create policy "Admins delete news" on public.public_news for delete to authenticated using (public.is_municipality_admin());

-- Private document bucket. Set the bucket's file size limit to 5MB in Storage settings.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('request-files', 'request-files', false, 5242880, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['application/pdf','image/jpeg','image/png'];

drop policy if exists "Visitors can upload request files" on storage.objects;
create policy "Visitors can upload request files" on storage.objects for insert to anon, authenticated with check (bucket_id = 'request-files');
drop policy if exists "Admins can read request files" on storage.objects;
create policy "Admins can read request files" on storage.objects for select to authenticated using (bucket_id = 'request-files' and public.is_municipality_admin());
drop policy if exists "Admins can delete request files" on storage.objects;
create policy "Admins can delete request files" on storage.objects for delete to authenticated using (bucket_id = 'request-files' and public.is_municipality_admin());

-- After creating an employee in Supabase Authentication > Users, run:
-- insert into public.admin_users (user_id) values ('REPLACE-WITH-AUTH-USER-UUID');

create type public.build_status as enum ('pending', 'building', 'completed', 'failed');

create table public.apk_builds (
  id uuid primary key default gen_random_uuid(),
  website_url text not null,
  app_name text not null,
  icon_url text,
  status build_status not null default 'pending',
  github_run_id text,
  artifact_url text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.apk_builds enable row level security;

create policy "Anyone can create builds"
  on public.apk_builds for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can read builds"
  on public.apk_builds for select
  to anon, authenticated
  using (true);

create policy "Service role can update builds"
  on public.apk_builds for update
  to service_role
  using (true)
  with check (true);
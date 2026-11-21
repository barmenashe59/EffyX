-- EffyX database setup. Run once in Supabase: SQL Editor -> New query -> paste -> Run.

-- 1. Each user's saved work (profile, CV versions, practice...). One row per item.
create table if not exists public.workspace (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null,
  data jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.workspace enable row level security;
drop policy if exists "workspace own read" on public.workspace;
drop policy if exists "workspace own insert" on public.workspace;
drop policy if exists "workspace own update" on public.workspace;
create policy "workspace own read" on public.workspace for select to authenticated using (auth.uid() = user_id);
create policy "workspace own insert" on public.workspace for insert to authenticated with check (auth.uid() = user_id);
create policy "workspace own update" on public.workspace for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update on public.workspace to authenticated;

-- 2. Pilot seats (max 20, enforced by the server). Users cannot read or write this table.
create table if not exists public.pilot_members (
  user_id uuid primary key references auth.users on delete cascade,
  email text,
  joined_at timestamptz not null default now()
);
alter table public.pilot_members enable row level security;

-- 3. Monthly usage per user (CV versions, practice sessions, dollars). Server only.
create table if not exists public.usage (
  user_id uuid not null references auth.users on delete cascade,
  month text not null,
  cv int not null default 0,
  practice_sessions text[] not null default '{}',
  usd numeric not null default 0,
  primary key (user_id, month)
);
alter table public.usage enable row level security;

grant all on public.workspace, public.pilot_members, public.usage to service_role;

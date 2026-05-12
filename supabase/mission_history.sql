create table if not exists public.mission_history (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drone_telemetry_history (
  id text primary key,
  history_id text not null,
  log_id text not null,
  recorded_at timestamptz not null,
  unit_id text not null,
  group_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_users (
  id text primary key,
  name text,
  login_id text,
  password_hash text,
  role text,
  status text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_sessions (
  id text primary key,
  user_id text,
  name text,
  role text,
  event_type text,
  is_active boolean default false,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_debug_logs (
  id text primary key,
  level text,
  category text,
  message text,
  user_id text,
  role text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users add column if not exists name text;
alter table public.app_users add column if not exists login_id text;
alter table public.app_users add column if not exists password_hash text;
alter table public.app_users add column if not exists role text;
alter table public.app_users add column if not exists status text;

alter table public.user_sessions add column if not exists user_id text;
alter table public.user_sessions add column if not exists name text;
alter table public.user_sessions add column if not exists role text;
alter table public.user_sessions add column if not exists event_type text;
alter table public.user_sessions add column if not exists is_active boolean default false;

alter table public.app_debug_logs add column if not exists level text;
alter table public.app_debug_logs add column if not exists category text;
alter table public.app_debug_logs add column if not exists message text;
alter table public.app_debug_logs add column if not exists user_id text;
alter table public.app_debug_logs add column if not exists role text;

create or replace function public.set_mission_history_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists mission_history_set_updated_at on public.mission_history;
drop trigger if exists app_settings_set_updated_at on public.app_settings;
drop trigger if exists drone_telemetry_history_set_updated_at on public.drone_telemetry_history;
drop trigger if exists app_users_set_updated_at on public.app_users;
drop trigger if exists user_sessions_set_updated_at on public.user_sessions;
drop trigger if exists app_debug_logs_set_updated_at on public.app_debug_logs;

create trigger mission_history_set_updated_at
before update on public.mission_history
for each row
execute function public.set_mission_history_updated_at();

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row
execute function public.set_mission_history_updated_at();

create trigger drone_telemetry_history_set_updated_at
before update on public.drone_telemetry_history
for each row
execute function public.set_mission_history_updated_at();

create trigger app_users_set_updated_at
before update on public.app_users
for each row
execute function public.set_mission_history_updated_at();

create trigger user_sessions_set_updated_at
before update on public.user_sessions
for each row
execute function public.set_mission_history_updated_at();

create trigger app_debug_logs_set_updated_at
before update on public.app_debug_logs
for each row
execute function public.set_mission_history_updated_at();

alter table public.mission_history enable row level security;
alter table public.app_settings enable row level security;
alter table public.drone_telemetry_history enable row level security;
alter table public.app_users enable row level security;
alter table public.user_sessions enable row level security;
alter table public.app_debug_logs enable row level security;

drop policy if exists "Allow anon read mission history" on public.mission_history;
create policy "Allow anon read mission history"
on public.mission_history
for select
to anon
using (true);

drop policy if exists "Allow anon write mission history" on public.mission_history;
create policy "Allow anon write mission history"
on public.mission_history
for insert
to anon
with check (true);

drop policy if exists "Allow anon update mission history" on public.mission_history;
create policy "Allow anon update mission history"
on public.mission_history
for update
to anon
using (true)
with check (true);

drop policy if exists "Allow anon read app settings" on public.app_settings;
create policy "Allow anon read app settings"
on public.app_settings
for select
to anon
using (true);

drop policy if exists "Allow anon write app settings" on public.app_settings;
create policy "Allow anon write app settings"
on public.app_settings
for insert
to anon
with check (true);

drop policy if exists "Allow anon update app settings" on public.app_settings;
create policy "Allow anon update app settings"
on public.app_settings
for update
to anon
using (true)
with check (true);

drop policy if exists "Allow anon read drone telemetry history" on public.drone_telemetry_history;
create policy "Allow anon read drone telemetry history"
on public.drone_telemetry_history
for select
to anon
using (true);

drop policy if exists "Allow anon write drone telemetry history" on public.drone_telemetry_history;
create policy "Allow anon write drone telemetry history"
on public.drone_telemetry_history
for insert
to anon
with check (true);

drop policy if exists "Allow anon update drone telemetry history" on public.drone_telemetry_history;
create policy "Allow anon update drone telemetry history"
on public.drone_telemetry_history
for update
to anon
using (true)
with check (true);

create index if not exists drone_telemetry_history_history_id_idx
on public.drone_telemetry_history (history_id, recorded_at desc);

create unique index if not exists drone_telemetry_history_log_unit_idx
on public.drone_telemetry_history (log_id, unit_id);

create unique index if not exists app_users_login_id_idx
on public.app_users (login_id);

drop policy if exists "Allow anon read app users" on public.app_users;
create policy "Allow anon read app users"
on public.app_users
for select
to anon
using (true);

drop policy if exists "Allow anon write app users" on public.app_users;
create policy "Allow anon write app users"
on public.app_users
for insert
to anon
with check (true);

drop policy if exists "Allow anon update app users" on public.app_users;
create policy "Allow anon update app users"
on public.app_users
for update
to anon
using (true)
with check (true);

drop policy if exists "Allow anon read user sessions" on public.user_sessions;
create policy "Allow anon read user sessions"
on public.user_sessions
for select
to anon
using (true);

drop policy if exists "Allow anon write user sessions" on public.user_sessions;
create policy "Allow anon write user sessions"
on public.user_sessions
for insert
to anon
with check (true);

drop policy if exists "Allow anon update user sessions" on public.user_sessions;
create policy "Allow anon update user sessions"
on public.user_sessions
for update
to anon
using (true)
with check (true);

drop policy if exists "Allow anon read app debug logs" on public.app_debug_logs;
create policy "Allow anon read app debug logs"
on public.app_debug_logs
for select
to anon
using (true);

drop policy if exists "Allow anon write app debug logs" on public.app_debug_logs;
create policy "Allow anon write app debug logs"
on public.app_debug_logs
for insert
to anon
with check (true);

drop policy if exists "Allow anon update app debug logs" on public.app_debug_logs;
create policy "Allow anon update app debug logs"
on public.app_debug_logs
for update
to anon
using (true)
with check (true);

create index if not exists app_debug_logs_created_at_idx
on public.app_debug_logs (created_at desc);

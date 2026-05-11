create table if not exists public.mission_history (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create trigger mission_history_set_updated_at
before update on public.mission_history
for each row
execute function public.set_mission_history_updated_at();

alter table public.mission_history enable row level security;

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

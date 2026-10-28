-- Replaces the single global webhook/schedule with:
--   - named webhooks, each tied to one sales person (the delivery target)
--   - a per-group schedule (its own webhook + interval, not a shared global one)
--   - per-participant "last sent to" tracking
--   - per-group sync history

create table if not exists webhooks (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  url text not null,
  sales_person_id uuid not null references sales_persons (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table tracked_groups
  add column if not exists webhook_id uuid references webhooks (id) on delete set null,
  add column if not exists interval_minutes integer;

alter table participants
  add column if not exists sent_to_sales_person_id uuid references sales_persons (id) on delete set null,
  add column if not exists sent_at timestamptz;

alter table sync_runs
  add column if not exists group_jid text references tracked_groups (group_jid) on delete cascade,
  add column if not exists trigger_type text not null default 'manual';

-- Superseded by the webhooks table + tracked_groups.interval_minutes.
drop table if exists app_settings;

alter table webhooks enable row level security;
create policy "deny all (service role bypasses rls)" on webhooks for all using (false);

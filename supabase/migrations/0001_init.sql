-- WhatsApp group participant sync: initial schema.
-- All application tables are written to exclusively by the backend using the
-- Supabase service-role key, which bypasses RLS. RLS is still enabled with a
-- deny-all policy as a safety net so the frontend's anon key (used only for
-- Supabase Auth) can never read/write app data directly.

create extension if not exists pgcrypto;

create table if not exists tracked_groups (
  id uuid primary key default gen_random_uuid(),
  group_jid text unique not null,
  group_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  group_jid text not null references tracked_groups (group_jid) on delete cascade,
  phone_number text not null,
  participant_jid text not null,
  first_seen_at timestamptz not null default now(),
  unique (group_jid, phone_number)
);

create table if not exists app_settings (
  id smallint primary key default 1,
  webhook_url text,
  interval_minutes integer not null default 60,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

insert into app_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null,
  finished_at timestamptz,
  groups_synced integer not null default 0,
  new_participants_count integer not null default 0,
  status text not null,
  error_message text
);

-- Baileys multi-file auth state, persisted as key/value JSON so the WhatsApp
-- login survives backend restarts/redeploys without a filesystem volume.
create table if not exists whatsapp_auth_state (
  key text primary key,
  value jsonb not null
);

alter table tracked_groups enable row level security;
alter table participants enable row level security;
alter table app_settings enable row level security;
alter table sync_runs enable row level security;
alter table whatsapp_auth_state enable row level security;

create policy "deny all (service role bypasses rls)" on tracked_groups for all using (false);
create policy "deny all (service role bypasses rls)" on participants for all using (false);
create policy "deny all (service role bypasses rls)" on app_settings for all using (false);
create policy "deny all (service role bypasses rls)" on sync_runs for all using (false);
create policy "deny all (service role bypasses rls)" on whatsapp_auth_state for all using (false);

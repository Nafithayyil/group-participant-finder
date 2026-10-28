-- Records every send attempt (manual or scheduled), success or failure, so
-- schedule health is visible in the UI instead of only the backend terminal.

create table if not exists webhook_send_log (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references webhooks (id) on delete cascade,
  attempted_at timestamptz not null default now(),
  status text not null,
  sent_count integer not null default 0,
  error_message text
);

create index if not exists webhook_send_log_webhook_id_attempted_at_idx
  on webhook_send_log (webhook_id, attempted_at desc);

alter table webhook_send_log enable row level security;
create policy "deny all (service role bypasses rls)" on webhook_send_log for all using (false);

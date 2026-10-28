-- Admin numbers are never imported by a fetch and never sent to a webhook.
-- phone_number is the primary key, so each number can only be stored once.

create table if not exists admin_numbers (
  phone_number text primary key,
  created_at timestamptz not null default now()
);

alter table admin_numbers enable row level security;
drop policy if exists "deny all (service role bypasses rls)" on admin_numbers;
create policy "deny all (service role bypasses rls)" on admin_numbers for all using (false);

insert into admin_numbers (phone_number) values
  ('919961027338'),
  ('917034422814'),
  ('917736507130'),
  ('919526377552'),
  ('918943515383'),
  ('918848115816')
on conflict do nothing;

notify pgrst, 'reload schema';
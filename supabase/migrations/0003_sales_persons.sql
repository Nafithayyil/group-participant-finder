create table if not exists sales_persons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table sales_persons enable row level security;
create policy "deny all (service role bypasses rls)" on sales_persons for all using (false);

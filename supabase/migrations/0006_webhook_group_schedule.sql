-- A webhook is now a full automation rule: name + url + sales person +
-- source group + optional schedule. Nullable so existing webhook rows from
-- before this change don't break; the backend enforces group_jid as
-- required for newly created webhooks.

alter table webhooks
  add column if not exists group_jid text references tracked_groups (group_jid) on delete cascade,
  add column if not exists interval_minutes integer;

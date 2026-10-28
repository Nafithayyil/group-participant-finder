-- Groups keep only a sync schedule (import participants into the DB on a
-- timer — identical to a manual "sync now", never sends anything anywhere).
-- Sending to a salesperson becomes a standalone action from the Webhooks
-- page, tracked per-participant by which webhook it went through (not just
-- which sales person), so re-sends can be blocked regardless of which
-- webhook is used next.

alter table tracked_groups
  drop column if exists webhook_id;

alter table participants
  add column if not exists sent_via_webhook_id uuid references webhooks (id) on delete set null,
  drop column if exists sent_to_sales_person_id;

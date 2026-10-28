-- Replaces sent_via_webhook_name with a simple status column on participants.
-- It starts as 'pending' and is set to 'sent' when the number is delivered to
-- a webhook.

alter table participants
  add column if not exists status text not null default 'pending';

update participants set status = 'sent' where sent_at is not null;

alter table participants drop column if exists sent_via_webhook_name;

notify pgrst, 'reload schema';

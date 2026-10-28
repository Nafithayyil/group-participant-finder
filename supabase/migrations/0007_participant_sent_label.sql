-- Store the webhook's name directly on the participant row at send time, so
-- it's readable straight from the participants table (not just via a join),
-- and stays a correct historical record even if the webhook is later renamed
-- or deleted.

alter table participants
  add column if not exists sent_via_webhook_name text;

-- Which kind of send produced each log row: 'scheduled', 'all' (Send all
-- numbers), 'unsent' (Send non-sent numbers) or 'custom' (Custom count).
-- Older rows stay null.

alter table webhook_send_log add column if not exists send_type text;

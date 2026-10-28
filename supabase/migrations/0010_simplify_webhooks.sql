-- The app is now a simple "fetch a group's new numbers, then send them to a
-- chosen webhook" tool. A webhook is just a name + URL; it is no longer tied to
-- a sales person or a specific group, and sending is always a manual button
-- click (no schedules). Columns from the old model are left in place but
-- unused, except that sales_person_id must become nullable so a webhook can be
-- created from a name and URL alone.

alter table webhooks alter column sales_person_id drop not null;

-- WhatsApp now hides real phone numbers behind an anonymous "LID" for many
-- group participants (a privacy feature, not something we can bypass). That
-- means phone_number is only ever best-effort and must be nullable, and the
-- stable identity for a participant is participant_jid (the chat id), not
-- phone_number.

alter table participants
  drop constraint if exists participants_group_jid_phone_number_key;

alter table participants
  alter column phone_number drop not null;

alter table participants
  add constraint participants_group_jid_participant_jid_key unique (group_jid, participant_jid);

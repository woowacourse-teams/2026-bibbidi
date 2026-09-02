-- Applies to databases created before TSK-35.
-- Newly created databases already get this column definition from bibbidi_mvp_schema.sql.
-- Marks appointments that became done because their checklist item was completed,
-- so that cancelling the checklist item completion can revert only those appointments.

USE bibbidi;

ALTER TABLE appointments
    ADD COLUMN done_by_checklist_item BOOLEAN NOT NULL DEFAULT FALSE AFTER is_done;

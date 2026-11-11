-- Run only against the dedicated bibbidi_loadtest database.
USE `bibbidi_loadtest`;
START TRANSACTION;

DELETE FROM appointments
WHERE id >= 900000000
   OR checklist_item_id IN (
       SELECT id FROM checklist_items
       WHERE checklist_id IN (SELECT id FROM checklists WHERE owner_id >= 900000000)
   );
DELETE FROM checklist_items
WHERE id >= 900000000
   OR checklist_id IN (SELECT id FROM checklists WHERE owner_id >= 900000000);
DELETE FROM checklists WHERE id >= 900000000 OR owner_id >= 900000000;
DELETE FROM refresh_sessions WHERE id >= 900000000 OR user_id >= 900000000;
DELETE FROM handoff_codes WHERE id >= 900000000 OR user_id >= 900000000;
DELETE FROM terms_agreements WHERE id >= 900000000 OR user_id >= 900000000;
DELETE FROM social_identities WHERE id >= 900000000 OR user_id >= 900000000;
DELETE FROM users WHERE id >= 900000000;

COMMIT;

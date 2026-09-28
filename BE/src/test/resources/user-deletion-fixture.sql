INSERT INTO users (id, nickname, password_hash, created_at, updated_at) VALUES
(1, 'current', '$argon2id$v=19$m=19456,t=2,p=1$mPT6Y0wsuHrmDa2H/HbqZQ$mA8UYY3PjaR5MI3uemA0KoJTHRYEDHG2ef6PafohlZg', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'other', '$argon2id$v=19$m=19456,t=2,p=1$mPT6Y0wsuHrmDa2H/HbqZQ$mA8UYY3PjaR5MI3uemA0KoJTHRYEDHG2ef6PafohlZg', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO categories (id, name, display_order, created_at, updated_at) VALUES
(1000, '웨딩홀', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO steps (id, category_id, name, description, display_order, created_at, updated_at) VALUES
(1000, 1000, '웨딩홀 계약', '웨딩홀을 결정하고 계약한다.', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO catalog_items (id, step_id, title, display_order, essential, created_at, updated_at) VALUES
(1000, 1000, '계약서 확인', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO checklists (id, owner_id, created_at, updated_at) VALUES
(1000, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(1001, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO checklist_items
(id, checklist_id, category_id, source_catalog_item_id, title, status, created_at, updated_at) VALUES
(1000, 1001, 1000, 1000, '계약서 확인', 'PREV', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO appointments
(id, checklist_item_id, title, appointment_date, start_time, end_time, place, memo, is_done, done_by_checklist_item, created_at, updated_at) VALUES
(1000, 1000, '웨딩홀 상담', '2026-09-01', NULL, NULL, NULL, NULL, FALSE, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

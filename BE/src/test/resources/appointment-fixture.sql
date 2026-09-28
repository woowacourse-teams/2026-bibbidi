INSERT INTO users (id, nickname, password_hash, created_at, updated_at) VALUES
(1, 'bibbidi', 'password-hash', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO checklists (id, owner_id, created_at, updated_at) VALUES
(1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO checklist_items (id, checklist_id, category_id, source_catalog_item_id, title, status, created_at, updated_at) VALUES
(1, 1, 1, NULL, '웨딩홀 계약', 'PREV', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

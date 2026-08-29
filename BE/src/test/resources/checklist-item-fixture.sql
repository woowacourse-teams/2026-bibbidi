INSERT INTO users (id, nickname, password_hash, created_at, updated_at) VALUES
(7, 'bibbidi', 'password-hash', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(8, 'other', 'password-hash', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO categories (id, name, display_order, created_at, updated_at) VALUES
(2, '웨딩홀', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, '스튜디오', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO steps (id, category_id, name, description, display_order, created_at, updated_at) VALUES
(11, 2, '웨딩홀 계약', '웨딩홀을 결정하고 계약한다.', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO catalog_items (id, step_id, title, display_order, essential, created_at, updated_at) VALUES
(100, 11, '계약서 확인', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO checklists (id, owner_id, created_at, updated_at) VALUES
(1000, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(1001, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO checklist_items
(id, checklist_id, category_id, source_catalog_item_id, title, status, created_at, updated_at) VALUES
(500, 1000, 2, NULL, '청첩장 문구 정하기', 'PREV', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(501, 1000, 2, 100, '계약서 확인', 'PREV', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(502, 1000, 2, NULL, '식순 정하기', 'DONE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(503, 1001, 2, NULL, '드레스 투어 예약', 'PREV', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

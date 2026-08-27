INSERT INTO categories (id, name, display_order, created_at, updated_at) VALUES
(1, '신혼여행', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, '웨딩홀', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO steps (id, category_id, name, description, display_order, created_at, updated_at) VALUES
(10, 2, '웨딩홀 상담', NULL, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(11, 2, '웨딩홀 계약', '웨딩홀을 결정하고 계약한다.', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO catalog_items (id, step_id, title, display_order, essential, created_at, updated_at) VALUES
(100, 11, '계약서 확인', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(101, 11, '견적 비교', 1, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO checklists (id, owner_id, created_at, updated_at) VALUES
(1000, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO checklist_items
(id, checklist_id, category_id, source_catalog_item_id, title, status, created_at, updated_at) VALUES
(2000, 1000, 2, 100, '계약서 확인', 'PREV', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

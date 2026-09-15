INSERT INTO users (id, nickname, password_hash, created_at, updated_at) VALUES
(7, 'bibbidi', 'password-hash', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO categories (id, name, display_order, created_at, updated_at) VALUES
(1, '웨딩홀', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, '스드메', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO steps (id, category_id, name, description, display_order, created_at, updated_at) VALUES
(10, 1, '웨딩홀 정하기', NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(11, 1, '예식 진행 방식 결정', NULL, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(12, 1, '예식 진행 인원 섭외', NULL, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(20, 2, '스드메 패키지 계약', NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(21, 2, '스드메 업체 확정', NULL, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO catalog_items (id, step_id, title, display_order, essential, created_at, updated_at) VALUES
(100, 10, '웨딩홀 투어', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(101, 11, '예식 형태 결정', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(102, 12, '주례·사회자 섭외', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(200, 20, '스드메 상담', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(201, 21, '드레스샵 확정', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO checklists (id, owner_id, created_at, updated_at) VALUES
(1000, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

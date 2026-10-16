-- 추천 시나리오의 사용자 상태는 대화로 제공하고 DB 체크리스트는 비어 있는 상태로 고정한다.
INSERT INTO users (id, nickname, status, role, created_at, updated_at) VALUES
(900001, 'ai-evaluation', 'ACTIVE', 'NORMAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO checklists (id, owner_id, created_at, updated_at) VALUES
(900001, 900001, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

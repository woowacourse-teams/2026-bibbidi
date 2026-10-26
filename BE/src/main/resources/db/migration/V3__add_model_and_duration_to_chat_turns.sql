ALTER TABLE chat_turns
    ADD COLUMN model VARCHAR(100) NOT NULL DEFAULT 'unknown' AFTER completion,
    ADD COLUMN duration_ms BIGINT NOT NULL DEFAULT 0 AFTER started_at;

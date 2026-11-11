CREATE TABLE chat_turns (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    conversation_id VARCHAR(36) NOT NULL,
    user_prompt TEXT NOT NULL,
    completion TEXT NOT NULL,
    outcome VARCHAR(20) NOT NULL,
    outcome_reason VARCHAR(30) NULL,
    started_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

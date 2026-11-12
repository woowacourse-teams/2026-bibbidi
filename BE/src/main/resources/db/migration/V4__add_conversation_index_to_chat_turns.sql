CREATE INDEX idx_chat_turns_user_conversation_started
    ON chat_turns (user_id, conversation_id, started_at);

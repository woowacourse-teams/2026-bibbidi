package com.bibbidi.wedding.chat.adapter.ai;

import com.bibbidi.wedding.chat.config.AiChatProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class ChatConversationCleanupScheduler {

    private final BibbidiInMemoryChatMemory memory;
    private final AiChatProperties properties;

    public ChatConversationCleanupScheduler(BibbidiInMemoryChatMemory memory, AiChatProperties properties) {
        this.memory = memory;
        this.properties = properties;
    }

    @Scheduled(
            fixedDelayString = "${bibbidi.ai.chatbot.conversation-cleanup-interval}",
            initialDelayString = "${bibbidi.ai.chatbot.conversation-cleanup-interval}"
    )
    public void evictIdleConversations() {
        int evicted = memory.evictIdle(properties.conversationIdleTimeout());
        if (evicted > 0) {
            log.info("오래 쓰지 않은 AI 대화를 정리했습니다. 정리수={}", evicted);
        }
    }
}

package com.bibbidi.wedding.chat.adapter.ai.config;

import com.bibbidi.wedding.chat.adapter.ai.BibbidiInMemoryChatMemory;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.binder.MeterBinder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class ChatMemoryMetricsConfig {

    @Bean
    MeterBinder aiChatMemoryConversations(BibbidiInMemoryChatMemory memory) {
        return registry -> Gauge.builder("ai.chat.memory.conversations", memory,
                        BibbidiInMemoryChatMemory::conversationCount)
                .register(registry);
    }
}

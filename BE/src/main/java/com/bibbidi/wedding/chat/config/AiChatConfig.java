package com.bibbidi.wedding.chat.config;

import static org.springframework.ai.chat.client.ChatClient.*;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.chat.service.tools.CatalogTools;
import com.bibbidi.wedding.chat.service.tools.ChecklistTools;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(AiChatProperties.class)
public class AiChatConfig {

    @Bean
    ChatClient aiChatClient(Builder builder, CatalogService catalogService, ChecklistService checklistService) {
        return builder.defaultSystem(AiChatPrompt.SYSTEM_PROMPT)
                .defaultTools(new CatalogTools(catalogService), new ChecklistTools(checklistService))
                .build();
    }

    @Bean
    ChatMemory aiChatMemory(AiChatProperties properties) {
        return MessageWindowChatMemory.builder()
                .chatMemoryRepository(new InMemoryChatMemoryRepository())
                .maxMessages(properties.memoryMaxMessages())
                .build();
    }

}

package com.bibbidi.wedding.chat.config;

import com.bibbidi.wedding.chat.domain.OpeningFlowPolicy;
import java.time.Clock;
import java.time.ZoneId;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableConfigurationProperties(ConversationStateProperties.class)
@EnableScheduling
public class ConversationStateConfiguration {

    @Bean
    public OpeningFlowPolicy openingFlowPolicy() {
        return new OpeningFlowPolicy();
    }

    @Bean
    public Clock conversationClock() {
        return Clock.system(ZoneId.of("Asia/Seoul"));
    }
}

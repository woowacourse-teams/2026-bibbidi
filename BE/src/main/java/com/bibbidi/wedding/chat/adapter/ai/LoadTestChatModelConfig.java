package com.bibbidi.wedding.chat.adapter.ai;

import java.util.concurrent.ThreadLocalRandom;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("loadtest")
@EnableConfigurationProperties(LoadTestChatModelProperties.class)
public class LoadTestChatModelConfig {

    @Bean
    @Primary
    public LoadTestChatModel loadTestChatModel(LoadTestChatModelProperties properties) {
        return new LoadTestChatModel(properties, () -> ThreadLocalRandom.current().nextDouble());
    }
}

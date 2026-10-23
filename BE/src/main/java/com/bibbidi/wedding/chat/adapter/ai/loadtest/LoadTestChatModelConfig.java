package com.bibbidi.wedding.chat.adapter.ai.loadtest;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("loadtest")
@EnableConfigurationProperties(LoadTestChatModelProperties.class)
public class LoadTestChatModelConfig {

    private static final String LOAD_TEST_ENVIRONMENT = "loadtest";

    @Bean
    @Primary
    public LoadTestChatModel loadTestChatModel(
            LoadTestChatModelProperties properties,
            @Value("${deployment.environment.name:}") String environmentName
    ) {
        if (!LOAD_TEST_ENVIRONMENT.equals(environmentName)) {
            throw new BusinessException(
                    ClientError.INTERNAL_ERROR,
                    "loadtest 프로필은 배포 환경 이름이 '" + LOAD_TEST_ENVIRONMENT + "'일 때만 사용할 수 있습니다: "
                            + "deployment.environment.name=" + environmentName
            );
        }
        return new LoadTestChatModel(properties, () -> ThreadLocalRandom.current().nextDouble());
    }
}

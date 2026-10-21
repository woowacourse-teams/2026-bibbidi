package com.bibbidi.wedding.chat.adapter.ai.loadtest;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.boot.context.annotation.UserConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class LoadTestChatModelConfigTest {

    @Test
    @DisplayName("loadtest 프로필에서만 모델 빈이 등록된다")
    void registersModelBeanOnlyUnderLoadTestProfile() {
        ApplicationContextRunner runner = new ApplicationContextRunner()
                .withConfiguration(UserConfigurations.of(LoadTestChatModelConfig.class));

        runner.run(context -> assertThat(context).doesNotHaveBean(ChatModel.class));
        runner.withPropertyValues("spring.profiles.active=loadtest", "deployment.environment.name=loadtest")
                .run(context -> assertThat(context).hasSingleBean(ChatModel.class));
    }

    @Test
    @DisplayName("부하 테스트 환경이 아니면 loadtest 프로필이 켜져도 시작에 실패한다")
    void failsToStartOutsideLoadTestEnvironmentEvenWithProfile() {
        ApplicationContextRunner runner = new ApplicationContextRunner()
                .withConfiguration(UserConfigurations.of(LoadTestChatModelConfig.class))
                .withPropertyValues("spring.profiles.active=loadtest");

        runner.run(context -> assertThat(context).hasFailed());
        runner.withPropertyValues("deployment.environment.name=production")
                .run(context -> assertThat(context).hasFailed());
    }
}

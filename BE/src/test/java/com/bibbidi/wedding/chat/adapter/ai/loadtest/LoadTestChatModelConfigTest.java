package com.bibbidi.wedding.chat.adapter.ai.loadtest;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.common.exception.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.boot.context.annotation.UserConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class LoadTestChatModelConfigTest {

    @Test
    @DisplayName("환경과 프로필이 loadtest 이면 ChatModel 빈이 등록된다")
    void registersModelBeanOnlyUnderLoadTestProfileAndEnvironmentIsLoadTest() {
        new ApplicationContextRunner()
                .withConfiguration(
                        UserConfigurations.of(LoadTestChatModelConfig.class)
                ).withPropertyValues(
                        "spring.profiles.active=loadtest",
                        "deployment.environment.name=loadtest"
                ).run(
                        context -> assertThat(context).hasSingleBean(ChatModel.class)
                );
    }

    @Test
    @DisplayName("loadtest 프로필이 없으면 환경 이름이 loadtest여도 ChatModel 빈이 등록되지 않는다")
    void unregistersModelBeanWithoutLoadTestProfile() {
        new ApplicationContextRunner()
                .withConfiguration(
                        UserConfigurations.of(LoadTestChatModelConfig.class)
                ).withPropertyValues(
                        "deployment.environment.name=loadtest"
                ).run(
                        context -> assertThat(context).doesNotHaveBean(ChatModel.class)
                );
    }

    @Test
    @DisplayName("loadtest 프로필이 켜져도 환경 이름이 loadtest가 아니면 시작에 실패한다")
    void failsToStartWhenProfileIsLoadTestButEnvironmentIsNot() {
        ApplicationContextRunner runner = new ApplicationContextRunner()
                .withConfiguration(
                        UserConfigurations.of(LoadTestChatModelConfig.class)
                ).withPropertyValues(
                        "spring.profiles.active=loadtest"
                );

        runner.run(context -> assertThat(context).getFailure()
                .hasRootCauseInstanceOf(BusinessException.class));
        runner.withPropertyValues("deployment.environment.name=production")
                .run(context -> assertThat(context).getFailure()
                        .hasRootCauseInstanceOf(BusinessException.class));
    }
}

package com.bibbidi.wedding.chat.evaluation.config;

import com.bibbidi.wedding.chat.evaluation.model.CliChatModel;
import com.bibbidi.wedding.chat.evaluation.report.RecordingChatModel;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

/**
 * 모든 {@code ChatModel}을 호출 기록용으로 감싸 {@code aiChatClient}가 기록용 모델을 쓰게 한다.
 * CLI 모델은 도구 결과를 붙인 재호출을 안에서 하므로, 그 재호출도 기록되도록 기록용 모델을 거치게 한다.
 */
@TestConfiguration(proxyBeanMethods = false)
public class ModelRecordingConfiguration {

    @Bean
    static BeanPostProcessor recordGenerationModels() {
        return new BeanPostProcessor() {
            @Override
            public Object postProcessAfterInitialization(Object bean, String beanName) {
                if (!(bean instanceof ChatModel model) || bean instanceof RecordingChatModel) {
                    return bean;
                }
                RecordingChatModel recording = new RecordingChatModel(model);
                if (model instanceof CliChatModel cliModel) {
                    cliModel.routeToolLoopThrough(recording);
                }
                return recording;
            }
        };
    }
}

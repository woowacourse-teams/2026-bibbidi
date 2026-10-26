package com.bibbidi.wedding.balancegame.adapter.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.bedrock.converse.BedrockChatOptions;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class BalanceGameAiConfigTest {

    @Test
    @DisplayName("등록된 ChatModel을 재사용하며 챗봇과 분리된 클라이언트와 모델 설정을 적용한다")
    void shouldUseSuppliedModelWithDedicatedClientAndOptions() {
        ChatModel model = mock(ChatModel.class);
        when(model.getOptions()).thenReturn(BedrockChatOptions.builder().model("qwen-default").build());
        AtomicReference<Prompt> captured = new AtomicReference<>();
        when(model.call(any(Prompt.class))).thenAnswer(invocation -> {
            captured.set(invocation.getArgument(0));
            return new ChatResponse(List.of(new Generation(new AssistantMessage("{\"recommendedItemIds\":[]}"))));
        });
        new ApplicationContextRunner()
                .withUserConfiguration(BalanceGameAiConfig.class)
                .withBean(ChatModel.class, () -> model)
                .withBean("aiChatClient", ChatClient.class, () -> mock(ChatClient.class))
                .withPropertyValues(
                        "spring.ai.model.chat=none",
                        "spring.ai.bedrock.converse.chat.model=qwen-default",
                        "bibbidi.ai.chatbot.sol-model=chatbot-sol",
                        "bibbidi.ai.balance-game.model=balance-game-sol")
                .run(context -> {
                    assertThat(context).hasNotFailed().hasSingleBean(ChatModel.class);
                    assertThat(context.getBean("balanceGameChatClient", ChatClient.class).prompt().user("입력")
                            .call().content()).isEqualTo("{\"recommendedItemIds\":[]}");
                    assertThat(captured.get().getOptions().getModel()).isEqualTo("balance-game-sol");
                    assertThat(context.getBeansOfType(ChatClient.class)).containsOnlyKeys(
                            "aiChatClient", "balanceGameChatClient");
                });
    }
}

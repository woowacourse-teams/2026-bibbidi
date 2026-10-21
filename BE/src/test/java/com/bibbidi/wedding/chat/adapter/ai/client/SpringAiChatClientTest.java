package com.bibbidi.wedding.chat.adapter.ai.client;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.chat.support.FakeChatModel;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import reactor.core.publisher.Flux;

class SpringAiChatClientTest {

    @Test
    @DisplayName("ChatClient로 생성한 클라이언트가 대화 기록과 요청 메시지를 순서대로 전달한다")
    void createsWithChatClientAndSendsMessagesInOrder() {
        // given
        FakeChatModel model = new FakeChatModel().respondWith(
                Flux.just(response("답변"))
        );
        SpringAiChatClient client = new SpringAiChatClient(ChatClient.create(model));

        List<Message> memories = List.of(new UserMessage("이전 질문"), new AssistantMessage("이전 답변"));
        UserMessage checklist = new UserMessage("체크리스트");
        UserMessage catalog = new UserMessage("카탈로그");
        UserMessage question = new UserMessage("현재 질문");

        // when
        client.stream(memories, checklist, catalog, question).blockLast();

        // then
        assertThat(model.lastPrompt().getInstructions())
                .extracting(Message::getText)
                .containsExactly("이전 질문", "이전 답변", "체크리스트", "카탈로그", "현재 질문");
    }

    @Test
    @DisplayName("ChatModel로 생성한 클라이언트가 모델에 요청을 전달한다")
    void createsWithChatModelAndSendsTheRequest() {
        // given
        FakeChatModel model = new FakeChatModel().respondWith(
                Flux.just(response("답변"))
        );
        SpringAiChatClient client = new SpringAiChatClient(model);

        // when
        client.stream(
                List.of(),
                new UserMessage("체크리스트"),
                new UserMessage("카탈로그"),
                new UserMessage("질문")
        ).blockLast();

        // then
        assertThat(model.prompts()).hasSize(1);
        assertThat(model.lastPrompt().getInstructions())
                .extracting(Message::getText)
                .containsExactly("체크리스트", "카탈로그", "질문");
    }

    @Test
    @DisplayName("모델의 ChatResponse 스트림을 변환 없이 전달한다")
    void returnsTheOriginalChatResponses() {
        // given
        ChatResponse first = response("첫 번째");
        ChatResponse second = response("두 번째");
        FakeChatModel model = new FakeChatModel().respondWith(
                Flux.just(first, second)
        );
        SpringAiChatClient client = new SpringAiChatClient(model);

        // when
        List<ChatResponse> actual = client.stream(
                        List.of(),
                        new UserMessage("체크리스트"),
                        new UserMessage("카탈로그"),
                        new UserMessage("질문")
                ).collectList()
                .block();

        // then
        assertThat(actual).hasSize(2);
        assertThat(actual.get(0)).isSameAs(first);
        assertThat(actual.get(1)).isSameAs(second);
    }

    private static ChatResponse response(String text) {
        AssistantMessage assistantMessage = new AssistantMessage(text);
        return new ChatResponse(
                List.of(new Generation(assistantMessage))
        );
    }
}

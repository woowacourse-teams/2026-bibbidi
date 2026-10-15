package com.bibbidi.wedding.chat.adapter.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.service.dto.prompt.BibbidiCustomChatPromptContext;
import com.bibbidi.wedding.chat.service.dto.prompt.ChecklistItemSnapshot;
import com.bibbidi.wedding.chat.service.dto.prompt.ChecklistSnapshot;
import com.bibbidi.wedding.chat.service.dto.result.AiResponseStream;
import com.bibbidi.wedding.chat.support.FakeChatModel;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import reactor.core.publisher.Flux;
import tools.jackson.databind.json.JsonMapper;

class SpringAiConversationAdapterTest {

    private static final String CONVERSATION = "7:7bf4d204-8331-439b-bd8f-271abc0eea99";

    private FakeChatModel model;
    private BibbidiInMemoryChatMemory memory;
    private SpringAiConversationAdapter adapter;

    @BeforeEach
    void setUp() {
        model = new FakeChatModel();
        memory = new BibbidiInMemoryChatMemory(new InMemoryChatMemoryRepository(), 18);
        adapter = new SpringAiConversationAdapter(ChatClient.create(model), memory,
                JsonMapper.builder().findAndAddModules().build());
    }

    @Test
    @DisplayName("이전 대화, 준비 정보, 카탈로그, 사용자 질문 순서로 모델에 전달한다")
    void sendsHistoryContextAndQuestionToTheModelInOrder() {
        // given
        memory.add(CONVERSATION, List.of(new UserMessage("예산은 1000"), new AssistantMessage("알겠습니다.")));
        model.respondWith(Flux.just(chunk("답변")));

        // when
        adapter.stream(CONVERSATION, "추천해줘", context()).content().blockLast();

        // then
        List<Message> instructions = model.lastPrompt().getInstructions();
        assertThat(instructions).extracting(Message::getText).hasSize(5)
                .startsWith("예산은 1000", "알겠습니다.")
                .endsWith("추천해줘");
        assertThat(instructions.get(2).getText()).contains("\"checklist\"", "웨딩홀 예약", "\"recommendableItemIds\"");
        assertThat(instructions.get(3).getText()).contains("\"catalog\"", "웨딩홀 후보 정하기");
    }

    @Test
    @DisplayName("모델이 보낸 답변 조각과 추천 가능한 항목 ID를 그대로 돌려준다")
    void returnsTheModelContentAndRecommendableItemIds() {
        // given
        model.respondWith(Flux.just(chunk("웨딩홀 "), chunk("계약")));

        // when
        AiResponseStream response = adapter.stream(CONVERSATION, "질문", context());

        // then
        assertThat(response.content().collectList().block()).containsExactly("웨딩홀 ", "계약");
        assertThat(response.recommendableItemIds()).containsExactlyInAnyOrder(2L, 3L);
    }

    @Test
    @DisplayName("호출할 때마다 대화에 연결한 준비 정보를 최신 값으로 바꾼다")
    void replacesThePromptContextOnEveryStream() {
        // given
        BibbidiCustomChatPromptContext latest = new BibbidiCustomChatPromptContext(
                ChecklistSnapshot.notFound(), List.of(), Set.of());
        model.respondWith(Flux.just(chunk("답변")));
        adapter.stream(CONVERSATION, "첫 질문", context()).content().blockLast();

        // when
        adapter.stream(CONVERSATION, "둘째 질문", latest).content().blockLast();

        // then
        assertThat(memory.bibbidiCustomContext(CONVERSATION)).isEqualTo(latest);
        assertThat(model.lastPrompt().getInstructions().get(0).getText()).contains("\"exists\":false");
    }

    @Test
    @DisplayName("질문과 답변을 한 쌍으로 대화 기록에 저장한다")
    void remembersTheQuestionAndAnswerAsAPair() {
        // when
        adapter.remember(CONVERSATION, "질문", "답변");

        // then
        assertThat(memory.get(CONVERSATION)).extracting(Message::getText).containsExactly("질문", "답변");
        assertThat(memory.get(CONVERSATION)).extracting(Message::getMessageType)
                .extracting(Enum::name).containsExactly("USER", "ASSISTANT");
    }

    private static BibbidiCustomChatPromptContext context() {
        ChecklistSnapshot checklist = new ChecklistSnapshot(true, List.of(
                new ChecklistItemSnapshot(1L, 1L, "웨딩홀 예약", "TODO", List.of())));
        List<CatalogItemDetailSnapshot> catalog = List.of(
                new CatalogItemDetailSnapshot(1L, "웨딩홀 후보 정하기", "웨딩홀", 1, "후보"),
                new CatalogItemDetailSnapshot(2L, "스튜디오 후보 정하기", "촬영", 1, "후보"));
        return new BibbidiCustomChatPromptContext(checklist, catalog, Set.of(2L, 3L));
    }

    private static ChatResponse chunk(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));
    }
}

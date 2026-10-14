package com.bibbidi.wedding.chat.infra.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistAppointmentResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemWithAppointmentsResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import tools.jackson.databind.json.JsonMapper;

class BibbidiChatMemoryTest {

    private static final String FIRST = "7:7bf4d204-8331-439b-bd8f-271abc0eea99";
    private static final String SECOND = "7:7bf4d204-8331-439b-bd8f-271abc0eea98";
    private static final String OTHER_USER = "8:7bf4d204-8331-439b-bd8f-271abc0eea99";
    private final InMemoryChatMemoryRepository repository = new InMemoryChatMemoryRepository();
    private final CatalogService catalog = mock(CatalogService.class);
    private final ChecklistService checklist = mock(ChecklistService.class);
    private final JsonMapper mapper = JsonMapper.builder().findAndAddModules().build();
    private final BibbidiChatMemory memory = new BibbidiChatMemory(repository, 20, catalog, checklist, mapper);

    @BeforeEach
    void setUp() {
        when(catalog.findAllItemDetails()).thenReturn(List.of(
                new CatalogItemDetailSnapshot(100L, "계약서 확인", "웨딩홀", 1, "계약"),
                new CatalogItemDetailSnapshot(200L, "촬영 후보", "촬영", 1, "후보")));
    }

    @Test
    @DisplayName("총 20개 중 고정 정보 2개는 유지하고 최근 대화 18개만 오래된 문답부터 교체한다")
    void keepsTwoFixedMessagesAndTheLatestNineTurns() {
        // given
        List<Message> fixed = memory.get(FIRST);

        // when
        for (int turn = 0; turn < 12; turn++) {
            memory.add(FIRST, List.of(new UserMessage("질문 " + turn), new AssistantMessage("답변 " + turn)));
        }
        List<Message> messages = memory.get(FIRST);

        // then
        assertThat(messages).hasSize(20);
        assertThat(messages.subList(0, 18)).extracting(Message::getText)
                .startsWith("질문 3", "답변 3").endsWith("질문 11", "답변 11");
        assertThat(messages.subList(18, 20)).extracting(Message::getText)
                .containsExactlyElementsOf(fixed.stream().map(Message::getText).toList());
        assertThat(fixed.getFirst().getText()).contains("checklist", "recommendableItemIds");
        assertThat(fixed.getLast().getText()).contains("catalog", "웨딩홀");
        verify(catalog, times(2)).findAllItemDetails();
        verify(checklist, times(2)).findMyChecklistIfPresent(7L);
    }

    @Test
    @DisplayName("같은 사용자의 고정 정보는 매번 조회하고 대화 기록과 다른 사용자 정보는 섞지 않는다")
    void refreshesFixedInformationWithoutMixingConversationsOrUsers() {
        // given
        when(checklist.findMyChecklistIfPresent(8L)).thenReturn(existingChecklist());
        memory.add(FIRST, List.of(new UserMessage("첫 대화"), new AssistantMessage("첫 답변")));
        memory.add(SECOND, List.of(new UserMessage("다른 대화"), new AssistantMessage("다른 답변")));

        // when
        List<Message> first = memory.get(FIRST);
        List<Message> second = memory.get(SECOND);
        List<Message> other = memory.get(OTHER_USER);

        // then
        assertThat(second.subList(2, 4)).extracting(Message::getText)
                .containsExactlyElementsOf(first.subList(2, 4).stream().map(Message::getText).toList());
        assertThat(second.subList(0, 2)).extracting(Message::getText).containsExactly("다른 대화", "다른 답변");
        assertThat(other).hasSize(2);
        assertThat(other.getFirst().getText()).contains("\"exists\":true");
        assertThat(first.get(2).getText()).contains("\"exists\":false");
        verify(checklist, times(2)).findMyChecklistIfPresent(7L);
        verify(checklist, times(1)).findMyChecklistIfPresent(8L);
    }

    @Test
    @DisplayName("한 대화를 삭제해도 고정 정보와 다른 대화 기록은 유지한다")
    void clearsOnlyTheSelectedConversationsHistory() {
        // given
        memory.add(FIRST, List.of(new UserMessage("삭제할 질문"), new AssistantMessage("삭제할 답변")));
        memory.add(SECOND, List.of(new UserMessage("유지할 질문"), new AssistantMessage("유지할 답변")));
        List<Message> fixed = memory.get(FIRST).subList(2, 4);

        // when
        memory.clear(FIRST);

        // then
        assertThat(memory.get(FIRST)).extracting(Message::getText)
                .containsExactlyElementsOf(fixed.stream().map(Message::getText).toList());
        assertThat(memory.get(SECOND)).extracting(Message::getText).startsWith("유지할 질문", "유지할 답변");
        verify(checklist, times(3)).findMyChecklistIfPresent(7L);
    }

    @Test
    @DisplayName("이벤트 없이 다음 조회에서 고정 메시지를 교체하고 다른 사용자 정보와 기존 문답은 유지한다")
    void refreshesFixedMessagesOnEveryReadWithoutGrowingTheHistory() {
        // given
        when(checklist.findMyChecklistIfPresent(7L)).thenReturn(Optional.empty(), existingChecklist());
        memory.add(FIRST, List.of(new UserMessage("기존 질문"), new AssistantMessage("기존 답변")));
        memory.get(FIRST);
        List<Message> other = memory.get(OTHER_USER);

        // when
        List<Message> messages = memory.get(FIRST);

        // then
        assertThat(messages).hasSize(4);
        assertThat(messages).extracting(Message::getText).startsWith("기존 질문", "기존 답변");
        assertThat(messages.get(2).getText()).contains("\"exists\":true");
        assertThat(repository.findByConversationId("user-info:7")).hasSize(2);
        assertThat(memory.get(OTHER_USER)).extracting(Message::getText)
                .containsExactlyElementsOf(other.stream().map(Message::getText).toList());
        verify(checklist, times(2)).findMyChecklistIfPresent(7L);
        verify(checklist, times(2)).findMyChecklistIfPresent(8L);
    }

    @Test
    @DisplayName("사용자별 체크리스트와 일정을 고정 정보에 담고 이미 추가한 항목은 추천 후보에서 제외한다")
    void storesPreparationAndOnlyRecommendableCatalogIds() {
        // given
        ChecklistAppointmentResult appointment = new ChecklistAppointmentResult(30L, "상담", LocalDate.of(2026, 11, 1),
                null, null, "서울", null, false);
        ChecklistItemWithAppointmentsResult item = new ChecklistItemWithAppointmentsResult(20L, 2L, 100L, "계약서 확인",
                ChecklistItemStatus.CONTINUE, LocalDateTime.of(2026, 10, 10, 10, 0), List.of(appointment));
        when(checklist.findMyChecklistIfPresent(7L))
                .thenReturn(Optional.of(new ChecklistWithAppointmentsResult(10L, List.of(item))), existingChecklist());

        // when
        Message first = memory.get(FIRST).getFirst();
        Message other = memory.get(OTHER_USER).getFirst();
        Message changed = memory.get(FIRST).getFirst();

        // then
        assertThat(first.getText()).contains("\"catalogItemId\":100", "\"status\":\"continue\"", "상담", "서울");
        assertThat(first.getMetadata().get("recommendableItemIds")).isEqualTo(Set.of(200L));
        assertThat(other.getMetadata().get("recommendableItemIds")).isEqualTo(Set.of(100L, 200L));
        assertThat(changed.getMetadata().get("recommendableItemIds")).isEqualTo(Set.of(100L, 200L));
    }

    @Test
    @DisplayName("체크리스트가 없는 상태와 조회 장애를 구분하고 조회 장애 시 고정 정보를 저장하지 않는다")
    void missingChecklistIsDifferentFromALookupFailure() {
        // given
        BusinessException failure = new BusinessException(ClientError.INTERNAL_ERROR, "조회 장애");
        when(checklist.findMyChecklistIfPresent(8L)).thenThrow(failure);

        // when, then
        assertThat(memory.get(FIRST).getFirst().getText()).contains("\"exists\":false");
        assertThatThrownBy(() -> memory.get(OTHER_USER)).isSameAs(failure);
        assertThat(repository.findByConversationId("user-info:8")).isEmpty();
    }

    private static Optional<ChecklistWithAppointmentsResult> existingChecklist() {
        return Optional.of(new ChecklistWithAppointmentsResult(10L, List.of()));
    }
}

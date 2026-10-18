package com.bibbidi.wedding.chat.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive;
import static org.springframework.transaction.support.TransactionSynchronizationManager.isCurrentTransactionReadOnly;

import com.bibbidi.wedding.catalog.repository.CatalogRepository;
import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.service.AiChatService;
import com.bibbidi.wedding.chat.adapter.ai.BibbidiInMemoryChatMemory;
import com.bibbidi.wedding.chat.adapter.catalog.CatalogServiceAdapter;
import com.bibbidi.wedding.chat.adapter.checklist.ChecklistServiceAdapter;
import com.bibbidi.wedding.chat.adapter.ai.SpringAiConversationAdapter;
import com.bibbidi.wedding.chat.service.parser.JacksonChatAnswerParser;
import com.bibbidi.wedding.chat.service.dto.result.ChatEvent;
import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.repository.AppointmentRepository;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import com.bibbidi.wedding.checklist.service.ChecklistAppointmentService;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.util.Shuffler;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.chat.service.dto.command.ChatCommand;
import com.bibbidi.wedding.chat.support.AiChatStreamRecorderFixture;
import com.bibbidi.wedding.chat.support.FakeChatModel;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.ai.bedrock.converse.BedrockChatOptions;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import reactor.core.publisher.Flux;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

class BibbidiCustomChatPromptContextTransactionTest {

    private final CatalogRepository catalog = mock(CatalogRepository.class);
    private final ChecklistRepository repository = mock(ChecklistRepository.class);
    private final FakeChatModel model = new FakeChatModel(BedrockChatOptions.builder().build());
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(TransactionConfig.class, CatalogService.class)
            .withBean(CatalogRepository.class, () -> catalog)
            .withBean(ChecklistRepository.class, () -> repository);

    @BeforeEach
    void setUp() {
        when(catalog.findAllItemDetails()).thenAnswer(invocation -> {
            assertThat(isActualTransactionActive()).isTrue();
            assertThat(isCurrentTransactionReadOnly()).isTrue();
            return List.of(new CatalogItemDetailSnapshot(1L, "웨딩홀", "장소", 1, "후보"));
        });
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    @DisplayName("체크리스트 존재 여부와 관계없이 읽기 전용 조회를 완료하고 트랜잭션 밖에서 모델을 호출한다")
    void loadsInAReadOnlyTransactionAndCallsTheModelAfterItEnds(boolean exists) {
        // given
        when(repository.findByOwnerId(7L)).thenAnswer(invocation -> {
            assertThat(isActualTransactionActive()).isTrue();
            assertThat(isCurrentTransactionReadOnly()).isTrue();
            return exists ? Optional.of(new Checklist(10L, 7L, List.of())) : Optional.empty();
        });
        model.respondWith(prompt -> {
            assertThat(isActualTransactionActive()).isFalse();
            return Flux.just(new ChatResponse(List.of(new Generation(
                    new AssistantMessage("{\"answer\":\"답변\",\"recommendedItemIds\":[]}")))));
        });
        runner.run(context -> {
            BibbidiInMemoryChatMemory memory = context.getBean(BibbidiInMemoryChatMemory.class);
            ObjectMapper mapper = context.getBean(ObjectMapper.class);
            ChecklistService checklist = context.getBean(ChecklistService.class);
            AiChatService chat = new AiChatService(new SpringAiConversationAdapter(ChatClient.create(model), memory, mapper,
                    AiChatStreamRecorderFixture.create()),
                    new CatalogServiceAdapter(context.getBean(CatalogService.class)),
                    new ChecklistServiceAdapter(checklist),
                    new JacksonChatAnswerParser(mapper));
            // when
            ChatEvent lastEvent = chat.chat(new ChatCommand(7L, UUID.randomUUID(), "질문")).blockLast();

            // then
            assertThat(isActualTransactionActive()).isFalse();
            assertThat(model.prompts()).hasSize(1);
            Prompt prompt = model.lastPrompt();
            assertThat(prompt.getInstructions()).extracting(message -> message.getText())
                    .anySatisfy(text -> assertThat(text).contains("\"exists\":" + exists));
            assertThat(context.getBean(ChatMemoryRepository.class).findByConversationId("user-info:7")).isEmpty();
            verify(repository, times(1)).findByOwnerId(7L);
            assertThat(lastEvent).isInstanceOf(ChatEvent.Done.class);
        });
    }

    @Test
    @DisplayName("실제 조회 장애는 트랜잭션을 종료하고 전달하며 사용자 정보 저장과 모델 호출을 하지 않는다")
    void lookupFailureDoesNotBecomeAnEmptyChecklistOrReachTheModel() {
        // given
        BusinessException failure = new BusinessException(ClientError.INTERNAL_ERROR, "조회 장애");
        when(repository.findByOwnerId(7L)).thenThrow(failure);
        runner.run(context -> {
            ChatMemoryRepository memoryRepository = context.getBean(ChatMemoryRepository.class);
            BibbidiInMemoryChatMemory memory = context.getBean(BibbidiInMemoryChatMemory.class);
            ObjectMapper mapper = context.getBean(ObjectMapper.class);
            ChecklistService checklist = context.getBean(ChecklistService.class);
            AiChatService chat = new AiChatService(new SpringAiConversationAdapter(ChatClient.create(model), memory, mapper,
                    AiChatStreamRecorderFixture.create()),
                    new CatalogServiceAdapter(context.getBean(CatalogService.class)),
                    new ChecklistServiceAdapter(checklist),
                    new JacksonChatAnswerParser(mapper));

            // when, then
            assertThatThrownBy(() -> chat.chat(new ChatCommand(7L, UUID.randomUUID(), "질문")).blockLast())
                    .isSameAs(failure);
            assertThat(isActualTransactionActive()).isFalse();
            assertThat(memoryRepository.findByConversationId("user-info:7")).isEmpty();
            assertThat(model.prompts()).isEmpty();
        });
    }

    @Configuration(proxyBeanMethods = false)
    @EnableTransactionManagement
    static class TransactionConfig {

        @Bean
        PlatformTransactionManager transactionManager() {
            return new DataSourceTransactionManager(new DriverManagerDataSource(
                    "jdbc:h2:mem:chat-context-" + UUID.randomUUID()));
        }

        @Bean
        ChecklistService checklistService(ChecklistRepository repository, CatalogService catalog) {
            return new ChecklistService(repository, catalog,
                    new ChecklistAppointmentService(mock(AppointmentRepository.class)),
                    new Shuffler() {
                        @Override
                        public <T> List<T> shuffle(List<T> values) {
                            return values;
                        }
                    });
        }

        @Bean
        ChatMemoryRepository chatMemoryRepository() {
            return new InMemoryChatMemoryRepository();
        }

        @Bean
        BibbidiInMemoryChatMemory chatMemory(ChatMemoryRepository repository) {
            return new BibbidiInMemoryChatMemory(repository, 18);
        }

        @Bean
        ObjectMapper objectMapper() {
            return JsonMapper.builder().findAndAddModules().build();
        }
    }
}

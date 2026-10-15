package com.bibbidi.wedding.chat.controller;

import static com.bibbidi.wedding.support.AuthenticationTestSupport.authenticatedUser;
import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.documentationConfiguration;
import static org.springframework.restdocs.operation.preprocess.Preprocessors.modifyHeaders;
import static org.springframework.restdocs.operation.preprocess.Preprocessors.preprocessRequest;
import static org.springframework.restdocs.operation.preprocess.Preprocessors.preprocessResponse;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.bibbidi.wedding.auth.token.BibbidiTokenClaims;
import com.bibbidi.wedding.auth.token.BibbidiTokenParser;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.adapter.ai.AiChatStreamRecorder;
import com.bibbidi.wedding.chat.adapter.ai.BibbidiInMemoryChatMemory;
import com.bibbidi.wedding.chat.adapter.ai.SpringAiConversationAdapter;
import com.bibbidi.wedding.chat.controller.dto.req.ChatRequest;
import com.bibbidi.wedding.chat.controller.sse.SseStreamManager;
import com.bibbidi.wedding.chat.controller.sse.config.SseConfig;
import com.bibbidi.wedding.chat.service.AiChatService;
import com.bibbidi.wedding.chat.service.parser.JacksonChatAnswerParser;
import com.bibbidi.wedding.chat.service.port.CatalogLookupPort;
import com.bibbidi.wedding.chat.service.port.ChecklistLookupPort;
import com.bibbidi.wedding.chat.support.AiChatStreamRecorderFixture;
import com.bibbidi.wedding.chat.support.FakeChatModel;
import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.domain.UserStatus;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.support.SecurityTestConfig;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import jakarta.servlet.AsyncEvent;
import jakarta.servlet.AsyncListener;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockAsyncContext;
import org.springframework.restdocs.RestDocumentationContextProvider;
import org.springframework.restdocs.RestDocumentationExtension;
import org.springframework.restdocs.payload.JsonFieldType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.web.context.WebApplicationContext;
import reactor.core.publisher.Flux;
import reactor.test.publisher.TestPublisher;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * 컨트롤러부터 서비스, 어댑터, 대화 메모리까지 실제 객체로 연결한다. 외부 경계인 Bedrock 모델 호출({@link FakeChatModel})과
 * DB 조회(카탈로그·체크리스트 포트)만 대역으로 바꾼다.
 */
@WebMvcTest(AiChatController.class)
@Import({
        SecurityTestConfig.class, SseStreamManager.class, SseConfig.class,
        AiChatService.class, SpringAiConversationAdapter.class, JacksonChatAnswerParser.class,
        AiChatControllerTest.ChatInfrastructure.class
})
@ExtendWith(RestDocumentationExtension.class)
class AiChatControllerTest {

    private static final String ID = "7bf4d204-8331-439b-bd8f-271abc0eea99";
    private static final long USER_ID = 7L;

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private FakeChatModel model;
    @MockitoBean
    private BibbidiTokenParser bibbidiTokenParser;
    @MockitoBean
    private CatalogLookupPort catalogLookup;
    @MockitoBean
    private ChecklistLookupPort checklistLookup;
    private MockMvc mockMvc;

    @TestConfiguration
    static class ChatInfrastructure {

        @Bean
        FakeChatModel fakeChatModel() {
            return new FakeChatModel();
        }

        @Bean
        ChatClient chatClient(FakeChatModel model) {
            return ChatClient.create(model);
        }

        @Bean
        BibbidiInMemoryChatMemory bibbidiInMemoryChatMemory() {
            return new BibbidiInMemoryChatMemory(new InMemoryChatMemoryRepository(), 18);
        }

        @Bean
        AiChatStreamRecorder aiChatStreamRecorder() {
            return AiChatStreamRecorderFixture.create();
        }
    }

    @BeforeEach
    void setUp(RestDocumentationContextProvider restDocumentation) {
        model.reset();
        when(catalogLookup.findAllItemDetails()).thenReturn(List.of(
                new CatalogItemDetailSnapshot(1L, "웨딩홀 후보 정하기", "웨딩홀", 1, "후보"),
                new CatalogItemDetailSnapshot(2L, "스튜디오 후보 정하기", "촬영", 1, "후보"),
                new CatalogItemDetailSnapshot(3L, "드레스 후보 정하기", "드레스", 1, "후보")));
        when(checklistLookup.filterRecommendableCatalogItemIds(USER_ID, List.of(1L, 2L, 3L)))
                .thenReturn(List.of(1L, 2L, 3L));
        mockMvc = webAppContextSetup(context).apply(springSecurity())
                .apply(documentationConfiguration(restDocumentation)).build();
    }

    @Test
    @DisplayName("응답이 완료되기 전에도 대화 ID와 답변 조각 및 추천 카드를 전송한다")
    void streamsConversationAnswerChunksAndComponentsBeforeCompletion() throws Exception {
        // given
        TestPublisher<ChatResponse> modelOutput = TestPublisher.create();
        model.respondWith(modelOutput.flux());

        // when
        MvcResult initial = mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new ChatRequest(UUID.fromString(ID), "다음 준비를 알려줘"))))
                .andReturn();

        try {
            await().untilAsserted(() -> modelOutput.assertSubscribers(1));
            modelOutput.next(chunk("{\"answer\":\"웨딩홀 "));

            // then: 모델 응답이 끝나기 전에 앞부분이 먼저 전달된다
            assertThat(initial.getRequest().isAsyncStarted()).isTrue();
            await().untilAsserted(() -> assertThat(body(initial))
                    .containsSubsequence("event:conversation", "\"conversationId\":\"" + ID + "\"",
                            "event:delta", "\"text\":\"웨딩홀 \"")
                    .doesNotContain("event:component", "event:done", "event:failure"));

            // when
            modelOutput.next(chunk("계약을 확인하세요.\",\"recommendedItemIds\":[1,2,3]}"));
            modelOutput.complete();

            // then
            await().untilAsserted(() -> assertThat(body(initial))
                    .containsSubsequence("event:delta", "계약을 확인하세요.", "event:component",
                            "data:{\"catalogItemIds\":[1,2,3]}", "event:done")
                    .doesNotContain("event:failure"));
        } finally {
            modelOutput.complete();
            initial.getAsyncResult(5000);
            mockMvc.perform(asyncDispatch(initial));
        }
    }

    @Test
    @DisplayName("정상 완료 시 SSE 응답 계약을 만족한다")
    void documentsTheCompletedSseResponseContract() throws Exception {
        // given
        model.respondWith(Flux.just(
                chunk("{\"answer\":\"웨딩홀 "),
                chunk("계약을 확인하세요.\",\"recommendedItemIds\":[1,2,3]}")));

        // when
        MvcResult initial = mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ChatRequest(null, "다음 준비를 알려줘"))))
                .andReturn();
        initial.getAsyncResult(5000);
        ResultActions completedResponse = mockMvc.perform(asyncDispatch(initial));

        // then
        MvcResult completed = completedResponse
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM))
                .andDo(document("ai-chat-stream",
                        preprocessRequest(modifyHeaders().set("Authorization", "Bearer <access-token>")),
                        preprocessResponse(), resource(ResourceSnippetParameters.builder()
                                .tag("AI Chat").summary("결혼 준비 AI 대화")
                                .description("로그인 사용자의 결혼 준비 질문에 SSE로 답변합니다. "
                                        + "대화 ID와 답변 조각을 전송하고, 추천 카드가 있으면 component 이벤트의 catalogItemIds 배열로 전달합니다. "
                                        + "배열 순서가 추천 순서이며, component는 도구 실행 시 답변 조각 사이에도 올 수 있습니다. "
                                        + "정상 완료 시 done, 실패 시 failure 이벤트를 보냅니다.")
                                .requestSchema(schema("ChatRequest"))
                                .responseSchema(schema("ChatEventStream"))
                                .requestHeaders(headerWithName("Authorization").description("로그인 access token. Bearer 인증"))
                                .requestFields(fieldWithPath("conversationId").type(JsonFieldType.STRING).optional()
                                                .description("이전 대화 UUID 문자열. 생략 또는 null이면 서버에서 생성"),
                                        fieldWithPath("message").description("사용자 메시지. 공백 제외 필수, 최대 4000자"))
                                .build()))).andReturn();
        assertThat(body(completed)).containsSubsequence("event:conversation", "event:delta", "웨딩홀 ",
                        "event:delta", "계약을 확인하세요.", "event:component", "data:{\"catalogItemIds\":[1,2,3]}",
                        "event:done")
                .doesNotContain("event:failure");
    }

    @Test
    @DisplayName("답변 생성이 실패하면 고정된 공개 오류 메시지를 전송하고 완료 이벤트를 보내지 않는다")
    void streamErrorsSendOnlyTheFixedPublicMessageAndNeverDone() throws Exception {
        // given
        model.respondWith(Flux.concat(
                Flux.just(chunk("{\"answer\":\"일부 답변")),
                Flux.error(new IllegalStateException("외부 API 비밀 원문"))));

        // when
        MvcResult initial = mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ChatRequest(UUID.fromString(ID), "질문"))))
                .andExpect(request().asyncStarted()).andReturn();
        initial.getAsyncResult(5000);

        // then
        MvcResult completed = mockMvc.perform(asyncDispatch(initial)).andExpect(status().isOk())
                .andDo(document("ai-chat-failure", resource(ResourceSnippetParameters.builder().tag("AI Chat")
                        .summary("AI 대화 생성 실패").description("SSE 시작 이후의 공개 실패 이벤트. 이후 done을 보내지 않습니다.")
                        .responseSchema(schema("ChatEventStream"))
                        .build()))).andReturn();
        assertThat(body(completed))
                .contains("event:delta", "일부 답변", "event:failure", ClientError.INTERNAL_ERROR.message())
                .doesNotContain("비밀", "event:done");
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    @DisplayName("토큰으로 인증한 SSE는 정상 완료와 실패 후에도 인증을 복원하며 다음 요청에 인증을 넘기지 않는다")
    void tokenAuthenticationSurvivesAsyncDispatchWithoutCreatingASession(boolean fails) throws Exception {
        // given
        String token = "test-access-token";
        when(bibbidiTokenParser.parseAccessToken(token)).thenReturn(
                new BibbidiTokenClaims(USER_ID, UserStatus.ACTIVE, UserRole.NORMAL, "테스트회원", null));
        CountDownLatch answerAllowed = new CountDownLatch(1);
        model.respondWith(Flux.defer(() -> {
            awaitLatch(answerAllowed);
            return fails
                    ? Flux.concat(Flux.just(chunk("{\"answer\":\"답변")),
                            Flux.error(new IllegalStateException("테스트 답변 생성 실패")))
                    : Flux.just(chunk("{\"answer\":\"답변\",\"recommendedItemIds\":[]}"));
        }));

        // when
        MvcResult initial;
        try {
            initial = mockMvc.perform(post("/api/ai/chat")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new ChatRequest(null, "질문"))))
                    .andExpect(request().asyncStarted()).andReturn();
        } finally {
            answerAllowed.countDown();
        }
        initial.getAsyncResult(5000);

        // then
        MvcResult completed = mockMvc.perform(asyncDispatch(initial))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM))
                .andReturn();
        assertThat(body(completed)).contains("event:conversation", "event:delta");
        if (fails) {
            assertThat(body(completed)).contains("event:failure").doesNotContain("event:done");
        } else {
            assertThat(body(completed)).contains("event:done").doesNotContain("event:failure");
        }
        assertThat(completed.getRequest().getSession(false)).isNull();
        verify(bibbidiTokenParser).parseAccessToken(token);

        // when, then: 이전 요청의 인증은 다음 요청으로 넘어가지 않는다
        mockMvc.perform(post("/api/ai/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ChatRequest(null, "다음 질문"))))
                .andExpect(status().isUnauthorized())
                .andExpect(request().asyncNotStarted())
                .andExpect(jsonPath("$.errorCode").value(ClientError.AUTHENTICATION_REQUIRED.errorCode()));
    }

    @Test
    @DisplayName("클라이언트 연결이 끊기면 모델 응답을 중단한다")
    void disconnectedClientCancelsTheModelResponse() throws Exception {
        // given
        CountDownLatch modelSubscribed = new CountDownLatch(1);
        AtomicBoolean modelCancelled = new AtomicBoolean();
        model.respondWith(Flux.<ChatResponse>never()
                .doOnSubscribe(subscription -> modelSubscribed.countDown())
                .doOnCancel(() -> modelCancelled.set(true)));
        MvcResult result = mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(USER_ID))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ChatRequest(UUID.fromString(ID), "질문")))).andReturn();
        await().until(() -> modelSubscribed.getCount() == 0);

        // when
        AsyncEvent event = new AsyncEvent(result.getRequest().getAsyncContext());
        for (AsyncListener listener : ((MockAsyncContext) event.getAsyncContext()).getListeners()) {
            listener.onError(event);
        }

        // then
        await().untilTrue(modelCancelled);
        assertThat(body(result)).doesNotContain("event:done");
    }

    @Test
    @DisplayName("서블릿 응답 시간이 초과되면 모델 응답을 중단하고 이후 이벤트를 전송하지 않는다")
    void servletTimeoutCancelsTheModelResponseWithoutSendingLateEvents() throws Exception {
        // given
        CountDownLatch modelSubscribed = new CountDownLatch(1);
        AtomicBoolean modelCancelled = new AtomicBoolean();
        model.respondWith(Flux.<ChatResponse>never()
                .doOnSubscribe(subscription -> modelSubscribed.countDown())
                .doOnCancel(() -> modelCancelled.set(true)));
        MvcResult initial = mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(USER_ID))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ChatRequest(UUID.fromString(ID), "질문")))).andReturn();
        await().until(() -> modelSubscribed.getCount() == 0);

        // when
        AsyncEvent event = new AsyncEvent(initial.getRequest().getAsyncContext());
        for (AsyncListener listener : ((MockAsyncContext) event.getAsyncContext()).getListeners()) {
            listener.onTimeout(event);
        }

        // then
        await().untilTrue(modelCancelled);
        String body = mockMvc.perform(asyncDispatch(initial)).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).doesNotContain("event:done", "event:delta");
    }

    @Test
    @DisplayName("인증되지 않은 요청은 스트리밍 시작 전에 거절한다")
    void unauthenticatedRequestsFailBeforeStreaming() throws Exception {
        // when, then
        mockMvc.perform(post("/api/ai/chat").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ChatRequest(null, "질문"))))
                .andExpect(status().isUnauthorized()).andExpect(request().asyncNotStarted())
                .andExpect(jsonPath("$.errorCode").value(ClientError.AUTHENTICATION_REQUIRED.errorCode()))
                .andDo(document("ai-chat-unauthenticated", resource(ResourceSnippetParameters.builder().tag("AI Chat")
                        .summary("AI 대화 인증 실패").responseFields(fieldWithPath("errorCode").description("인증 오류 코드"),
                                fieldWithPath("message").description("공개 인증 오류 메시지")).build())));
        assertNothingWasProcessed();
    }

    @Test
    @DisplayName("약관에 동의하지 않은 사용자의 요청은 스트리밍 시작 전에 거절한다")
    void pendingUsersCannotStartTheStream() throws Exception {
        // when, then
        mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(USER_ID, UserStatus.PENDING))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ChatRequest(null, "질문"))))
                .andExpect(status().isForbidden()).andExpect(request().asyncNotStarted())
                .andDo(document("ai-chat-forbidden", resource(ResourceSnippetParameters.builder().tag("AI Chat")
                        .summary("AI 대화 접근 권한 오류").description("약관 미동의 사용자는 SSE 시작 전에 HTTP 403으로 거절됩니다.")
                        .responseFields(fieldWithPath("errorCode").description("접근 권한 오류 코드"),
                                fieldWithPath("message").description("공개 접근 권한 오류 메시지")).build())));
        assertNothingWasProcessed();
    }

    @Test
    @DisplayName("대화 ID 문자열을 UUID로 변환하여 같은 대화로 처리한다")
    void convertsTheConversationIdToUuidBeforeProcessingTheChat() throws Exception {
        // given
        model.respondWith(Flux.just(chunk("{\"answer\":\"답변\",\"recommendedItemIds\":[]}")));
        ObjectNode request = (ObjectNode) objectMapper.valueToTree(new ChatRequest(UUID.fromString(ID), "질문"));
        request.put("conversationId", ID.toUpperCase(Locale.ROOT));

        // when
        MvcResult initial = mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(request().asyncStarted()).andReturn();
        initial.getAsyncResult(5000);

        // then
        MvcResult completed = mockMvc.perform(asyncDispatch(initial)).andExpect(status().isOk()).andReturn();
        assertThat(body(completed))
                .contains("\"conversationId\":\"" + ID + "\"", "event:done")
                .doesNotContain("event:failure");
        assertThat(model.lastPrompt().getInstructions().getLast().getText()).isEqualTo("질문");
    }

    @ParameterizedTest
    @DisplayName("대화 ID를 UUID로 변환할 수 없으면 스트리밍 시작 전에 거절한다")
    @ValueSource(strings = {"invalid", "7bf4d204-8331-439b-bd8f-271abc0eea9z"})
    void malformedUuidFailsBeforeStreaming(String conversationId) throws Exception {
        // given
        ObjectNode request = (ObjectNode) objectMapper.valueToTree(new ChatRequest(null, "질문"));
        request.put("conversationId", conversationId);

        // when, then
        mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(USER_ID)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest()).andExpect(request().asyncNotStarted())
                .andExpect(jsonPath("$.errorCode").value(ClientError.INVALID_REQUEST.errorCode()))
                .andDo(document("ai-chat-invalid-request", resource(ResourceSnippetParameters.builder().tag("AI Chat")
                        .summary("AI 대화 요청 값 오류")
                        .description("UUID로 변환할 수 없는 대화 ID는 SSE 시작 전에 HTTP 400으로 거절됩니다.")
                        .responseFields(fieldWithPath("errorCode").description("요청 오류 코드"),
                                fieldWithPath("message").description("공개 요청 오류 메시지")).build())));
        assertNothingWasProcessed();
    }

    @ParameterizedTest
    @DisplayName("메시지가 비어 있거나 최대 길이를 초과하면 스트리밍 시작 전에 거절한다")
    @MethodSource("invalidRequests")
    void invalidInputFailsBeforeStreaming(ChatRequest request) throws Exception {
        // when, then
        mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(USER_ID)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest()).andExpect(request().asyncNotStarted())
                .andExpect(jsonPath("$.errorCode").value(ClientError.INVALID_REQUEST.errorCode()));
        assertNothingWasProcessed();
    }

    static Stream<ChatRequest> invalidRequests() {
        return Stream.of(new ChatRequest(null, " "), new ChatRequest(null, null),
                new ChatRequest(null, "가".repeat(4001)));
    }

    private void assertNothingWasProcessed() {
        verifyNoInteractions(catalogLookup, checklistLookup);
        assertThat(model.prompts()).isEmpty();
    }

    private static String body(MvcResult result) throws Exception {
        return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private static ChatResponse chunk(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));
    }

    private static void awaitLatch(CountDownLatch latch) {
        try {
            latch.await();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new CancellationException("응답 중단");
        }
    }
}

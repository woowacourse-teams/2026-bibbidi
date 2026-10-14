package com.bibbidi.wedding.chat.controller;

import static com.bibbidi.wedding.support.AuthenticationTestSupport.authenticatedUser;
import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.ResourceDocumentation.headerWithName;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.documentationConfiguration;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.restdocs.operation.preprocess.Preprocessors.modifyHeaders;
import static org.springframework.restdocs.operation.preprocess.Preprocessors.preprocessRequest;
import static org.springframework.restdocs.operation.preprocess.Preprocessors.preprocessResponse;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.bibbidi.wedding.chat.config.AiChatProperties;
import com.bibbidi.wedding.auth.token.BibbidiTokenClaims;
import com.bibbidi.wedding.auth.token.BibbidiTokenParser;
import com.bibbidi.wedding.chat.controller.dto.req.ChatRequest;
import com.bibbidi.wedding.chat.service.AiChatService;
import com.bibbidi.wedding.chat.service.ChatSseHandler;
import com.bibbidi.wedding.chat.service.dto.ChatResult;
import com.bibbidi.wedding.common.domain.UserStatus;
import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.chat.infra.sse.SseStreamManager;
import com.bibbidi.wedding.chat.infra.sse.config.SseConfig;
import com.bibbidi.wedding.support.SecurityTestConfig;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import jakarta.servlet.AsyncEvent;
import jakarta.servlet.AsyncListener;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CancellationException;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
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
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@WebMvcTest(AiChatController.class)
@Import({SecurityTestConfig.class, SseStreamManager.class, SseConfig.class})
@EnableConfigurationProperties(AiChatProperties.class)
@ExtendWith(RestDocumentationExtension.class)
class AiChatControllerTest {

    private static final String ID = "7bf4d204-8331-439b-bd8f-271abc0eea99";

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private ObjectMapper objectMapper;
    @MockitoBean
    private BibbidiTokenParser bibbidiTokenParser;
    @MockitoBean
    private AiChatService aiChatService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp(RestDocumentationContextProvider restDocumentation) {
        mockMvc = webAppContextSetup(context).apply(springSecurity())
                .apply(documentationConfiguration(restDocumentation)).build();
    }

    @Test
    @DisplayName("응답이 완료되기 전에도 대화 ID와 답변 조각 및 추천 카드를 전송한다")
    void streamsConversationAnswerChunksAndComponentsBeforeCompletion() throws Exception {
        // given
        CountDownLatch answerChunkAllowed = new CountDownLatch(1);
        CountDownLatch completionAllowed = new CountDownLatch(1);
        doAnswer(invocation -> {
            ChatSseHandler reply = invocation.getArgument(3);
            reply.conversation(ID);
            answerChunkAllowed.await();
            reply.sendAnswerChunk("웨딩홀 ");
            reply.sendComponent(List.of(1L, 2L, 3L));
            completionAllowed.await();
            reply.complete(new ChatResult(ID, "웨딩홀 "), () -> {});
            return null;
        }).when(aiChatService).chat(eq(7L), any(), eq("다음 준비를 알려줘"), any(ChatSseHandler.class));

        // when
        MvcResult initial = mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(7L))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ChatRequest(null, "다음 준비를 알려줘"))))
                .andReturn();

        try {
            await().until(() -> initial.getResponse().getContentAsString(StandardCharsets.UTF_8)
                    .contains("event:conversation"));
            answerChunkAllowed.countDown();

            // then
            assertThat(initial.getRequest().isAsyncStarted()).isTrue();
            await().untilAsserted(() -> {
                String body = initial.getResponse().getContentAsString(StandardCharsets.UTF_8);
                assertThat(body)
                        .containsSubsequence("event:conversation", "\"conversationId\":\"" + ID + "\"",
                                "event:delta", "\"text\":\"웨딩홀 \"", "event:component",
                                "data:{\"catalogItemIds\":[1,2,3]}")
                        .doesNotContain("event:done", "event:failure");
            });
        } finally {
            answerChunkAllowed.countDown();
            completionAllowed.countDown();
            initial.getAsyncResult(5000);
            mockMvc.perform(asyncDispatch(initial));
        }
    }

    @Test
    @DisplayName("정상 완료 시 SSE 응답 계약을 만족한다")
    void documentsTheCompletedSseResponseContract() throws Exception {
        // given
        doAnswer(invocation -> {
            ChatSseHandler reply = invocation.getArgument(3);
            reply.conversation(ID);
            reply.sendAnswerChunk("웨딩홀 ");
            reply.sendAnswerChunk("계약을 확인하세요.");
            reply.sendComponent(List.of(1L, 2L, 3L));
            reply.complete(new ChatResult(ID, "웨딩홀 계약을 확인하세요."), () -> {});
            return null;
        }).when(aiChatService).chat(eq(7L), any(), eq("다음 준비를 알려줘"), any(ChatSseHandler.class));

        // when
        MvcResult initial = mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(7L))
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
                        .requestFields(fieldWithPath("conversationId").type(JsonFieldType.STRING).optional().description("이전 대화 UUID 문자열. 생략 또는 null이면 서버에서 생성"),
                                fieldWithPath("message").description("사용자 메시지. 공백 제외 필수, 최대 4000자"))
                        .build()))).andReturn();
        String body = completed.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).containsSubsequence("event:conversation", "event:delta", "웨딩홀 ", "event:delta", "계약을 확인하세요.",
                        "event:component", "data:{\"catalogItemIds\":[1,2,3]}", "event:done")
                .doesNotContain("event:failure");
    }

    @Test
    @DisplayName("답변 생성이 실패하면 고정된 공개 오류 메시지를 전송하고 완료 이벤트를 보내지 않는다")
    void streamErrorsSendOnlyTheFixedPublicMessageAndNeverDone() throws Exception {
        // given
        doAnswer(invocation -> {
            ChatSseHandler reply = invocation.getArgument(3);
            reply.conversation(ID);
            reply.sendAnswerChunk("일부 답변");
            throw new IllegalStateException("외부 API 비밀 원문");
        }).when(aiChatService).chat(eq(7L), any(), any(), any(ChatSseHandler.class));

        // when
        MvcResult initial = mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(7L)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ChatRequest(UUID.fromString(ID), "질문"))))
                .andExpect(request().asyncStarted()).andReturn();
        initial.getAsyncResult(5000);

        // then
        MvcResult completed = mockMvc.perform(asyncDispatch(initial)).andExpect(status().isOk())
                .andDo(document("ai-chat-failure", resource(ResourceSnippetParameters.builder().tag("AI Chat")
                        .summary("AI 대화 생성 실패").description("SSE 시작 이후의 공개 실패 이벤트. 이후 done을 보내지 않습니다.")
                        .responseSchema(schema("ChatEventStream"))
                        .build()))).andReturn();
        assertThat(completed.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .contains("event:failure", ClientError.INTERNAL_ERROR.message()).doesNotContain("비밀", "event:done");
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    @DisplayName("토큰으로 인증한 SSE는 정상 완료와 실패 후에도 인증을 복원하며 다음 요청에 인증을 넘기지 않는다")
    void tokenAuthenticationSurvivesAsyncDispatchWithoutCreatingASession(boolean fails) throws Exception {
        // given
        String token = "test-access-token";
        when(bibbidiTokenParser.parseAccessToken(token)).thenReturn(
                new BibbidiTokenClaims(7L, UserStatus.ACTIVE, UserRole.NORMAL, "테스트회원", null));
        CountDownLatch completionAllowed = new CountDownLatch(1);
        doAnswer(invocation -> {
            ChatSseHandler reply = invocation.getArgument(3);
            reply.conversation(ID);
            completionAllowed.await();
            reply.sendAnswerChunk("답변");
            reply.sendComponent(List.of(1L, 2L));
            if (fails) {
                throw new IllegalStateException("테스트 답변 생성 실패");
            }
            reply.complete(new ChatResult(ID, "답변"), () -> {});
            return null;
        }).when(aiChatService).chat(eq(7L), any(), eq("질문"), any(ChatSseHandler.class));

        // when
        MvcResult initial;
        try {
            initial = mockMvc.perform(post("/api/ai/chat")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new ChatRequest(null, "질문"))))
                    .andExpect(request().asyncStarted()).andReturn();
        } finally {
            completionAllowed.countDown();
        }
        initial.getAsyncResult(5000);

        // then
        MvcResult completed = mockMvc.perform(asyncDispatch(initial))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM))
                .andReturn();
        String body = completed.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).contains("event:conversation", "event:delta", "event:component");
        if (fails) {
            assertThat(body).contains("event:failure").doesNotContain("event:done");
        } else {
            assertThat(body).contains("event:done").doesNotContain("event:failure");
        }
        assertThat(completed.getRequest().getSession(false)).isNull();
        verify(bibbidiTokenParser).parseAccessToken(token);
        verify(aiChatService).chat(eq(7L), any(), eq("질문"), any(ChatSseHandler.class));

        mockMvc.perform(post("/api/ai/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ChatRequest(null, "다음 질문"))))
                .andExpect(status().isUnauthorized())
                .andExpect(request().asyncNotStarted())
                .andExpect(jsonPath("$.errorCode").value(ClientError.AUTHENTICATION_REQUIRED.errorCode()));
    }

    @Test
    @DisplayName("클라이언트 연결이 끊기면 응답 작업을 중단한다")
    void disconnectedClientInterruptsTheResponseWorker() throws Exception {
        // given
        CountDownLatch started = new CountDownLatch(1);
        AtomicBoolean cancelled = new AtomicBoolean();
        doAnswer(invocation -> {
            ChatSseHandler reply = invocation.getArgument(3);
            reply.conversation(ID);
            started.countDown();
            try {
                new CountDownLatch(1).await();
            } catch (InterruptedException exception) {
                cancelled.set(true);
                throw exception;
            }
            return null;
        }).when(aiChatService).chat(eq(7L), any(), any(), any(ChatSseHandler.class));
        MvcResult result = mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(7L)).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ChatRequest(UUID.fromString(ID), "질문")))).andReturn();
        await().until(() -> started.getCount() == 0);

        // when
        AsyncEvent event = new AsyncEvent(result.getRequest().getAsyncContext());
        for (AsyncListener listener : ((MockAsyncContext) event.getAsyncContext()).getListeners()) {
            listener.onError(event);
        }

        // then
        await().untilTrue(cancelled);
        assertThat(result.getResponse().getContentAsString()).doesNotContain("event:done");
    }

    @Test
    @DisplayName("서블릿 응답 시간이 초과되면 응답 작업을 중단하고 이후 이벤트를 전송하지 않는다")
    void servletTimeoutInterruptsTheWorkerWithoutSendingLateEvents() throws Exception {
        // given
        AtomicReference<ChatSseHandler> source = new AtomicReference<ChatSseHandler>();
        AtomicBoolean cancelled = new AtomicBoolean();
        doAnswer(invocation -> {
            ChatSseHandler reply = invocation.getArgument(3);
            reply.conversation(ID);
            source.set(reply);
            try {
                new CountDownLatch(1).await();
            } catch (InterruptedException exception) {
                cancelled.set(true);
                throw exception;
            }
            return null;
        }).when(aiChatService).chat(eq(7L), any(), any(), any(ChatSseHandler.class));
        MvcResult initial = mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(7L)).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ChatRequest(UUID.fromString(ID), "질문")))).andReturn();
        await().until(() -> source.get() != null);

        // when
        AsyncEvent event = new AsyncEvent(initial.getRequest().getAsyncContext());
        List<AsyncListener> listeners = ((MockAsyncContext) event.getAsyncContext()).getListeners();
        for (AsyncListener listener : listeners) {
            listener.onTimeout(event);
        }

        // then
        assertThatThrownBy(() -> source.get().sendAnswerChunk("늦은 답변")).isInstanceOf(CancellationException.class);
        await().untilTrue(cancelled);
        String body = mockMvc.perform(asyncDispatch(initial)).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).doesNotContain("늦은 답변", "event:done", "event:delta");
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
        verifyNoInteractions(aiChatService);
    }

    @Test
    @DisplayName("약관에 동의하지 않은 사용자의 요청은 스트리밍 시작 전에 거절한다")
    void pendingUsersCannotStartTheStream() throws Exception {
        // when, then
        mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(7L, UserStatus.PENDING)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ChatRequest(null, "질문"))))
                .andExpect(status().isForbidden()).andExpect(request().asyncNotStarted())
                .andDo(document("ai-chat-forbidden", resource(ResourceSnippetParameters.builder().tag("AI Chat")
                        .summary("AI 대화 접근 권한 오류").description("약관 미동의 사용자는 SSE 시작 전에 HTTP 403으로 거절됩니다.")
                        .responseFields(fieldWithPath("errorCode").description("접근 권한 오류 코드"),
                                fieldWithPath("message").description("공개 접근 권한 오류 메시지")).build())));
        verifyNoInteractions(aiChatService);
    }

    @Test
    @DisplayName("대화 ID 문자열을 UUID로 변환하여 서비스에 전달한다")
    void convertsTheConversationIdToUuidBeforeCallingTheService() throws Exception {
        // given
        UUID id = UUID.fromString(ID);
        doAnswer(invocation -> {
            ChatSseHandler reply = invocation.getArgument(3);
            reply.conversation(ID);
            reply.complete(new ChatResult(ID, "답변"), () -> {});
            return null;
        }).when(aiChatService).chat(eq(7L), eq(id), eq("질문"), any(ChatSseHandler.class));
        ObjectNode request = (ObjectNode) objectMapper.valueToTree(new ChatRequest(id, "질문"));
        request.put("conversationId", ID.toUpperCase(Locale.ROOT));

        // when
        MvcResult initial = mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(7L)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(request().asyncStarted()).andReturn();
        initial.getAsyncResult(5000);

        // then
        MvcResult completed = mockMvc.perform(asyncDispatch(initial)).andExpect(status().isOk()).andReturn();

        verify(aiChatService).chat(eq(7L), eq(id), eq("질문"), any(ChatSseHandler.class));
        assertThat(completed.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .contains("event:done").doesNotContain("event:failure");
    }

    @ParameterizedTest
    @DisplayName("대화 ID를 UUID로 변환할 수 없으면 스트리밍 시작 전에 거절한다")
    @ValueSource(strings = {"invalid", "7bf4d204-8331-439b-bd8f-271abc0eea9z"})
    void malformedUuidFailsBeforeStreaming(String conversationId) throws Exception {
        // given
        ObjectNode request = (ObjectNode) objectMapper.valueToTree(new ChatRequest(null, "질문"));
        request.put("conversationId", conversationId);

        // when, then
        mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(7L)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest()).andExpect(request().asyncNotStarted())
                .andExpect(jsonPath("$.errorCode").value(ClientError.INVALID_REQUEST.errorCode()))
                .andDo(document("ai-chat-invalid-request", resource(ResourceSnippetParameters.builder().tag("AI Chat")
                        .summary("AI 대화 요청 값 오류").description("UUID로 변환할 수 없는 대화 ID는 SSE 시작 전에 HTTP 400으로 거절됩니다.")
                        .responseFields(fieldWithPath("errorCode").description("요청 오류 코드"),
                                fieldWithPath("message").description("공개 요청 오류 메시지")).build())));
        verifyNoInteractions(aiChatService);
    }

    @ParameterizedTest
    @DisplayName("메시지가 비어 있거나 최대 길이를 초과하면 스트리밍 시작 전에 거절한다")
    @MethodSource("invalidRequests")
    void invalidInputFailsBeforeStreaming(ChatRequest request) throws Exception {
        // when, then
        mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(7L)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest()).andExpect(request().asyncNotStarted())
                .andExpect(jsonPath("$.errorCode").value(ClientError.INVALID_REQUEST.errorCode()));
        verifyNoInteractions(aiChatService);
    }

    static Stream<ChatRequest> invalidRequests() {
        return Stream.of(new ChatRequest(null, " "), new ChatRequest(null, null),
                new ChatRequest(null, "가".repeat(4001)));
    }
}

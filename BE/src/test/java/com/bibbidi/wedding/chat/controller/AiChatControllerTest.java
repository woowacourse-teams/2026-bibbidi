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
import com.bibbidi.wedding.chat.controller.dto.req.ChatRequest;
import com.bibbidi.wedding.chat.service.AiChatService;
import com.bibbidi.wedding.chat.service.ChatReplyHandler;
import com.bibbidi.wedding.chat.service.dto.ChatResult;
import com.bibbidi.wedding.common.domain.UserStatus;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.sse.service.SseService;
import com.bibbidi.wedding.sse.config.SseConfig;
import com.bibbidi.wedding.support.SecurityTestConfig;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CancellationException;
import org.junit.jupiter.api.BeforeEach;
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
import org.springframework.restdocs.RestDocumentationContextProvider;
import org.springframework.restdocs.RestDocumentationExtension;
import org.springframework.restdocs.payload.JsonFieldType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@WebMvcTest(AiChatController.class)
@Import({SecurityTestConfig.class, SseService.class, SseConfig.class})
@EnableConfigurationProperties(AiChatProperties.class)
@ExtendWith(RestDocumentationExtension.class)
class AiChatControllerTest {

    private static final String ID = "7bf4d204-8331-439b-bd8f-271abc0eea99";

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private ObjectMapper objectMapper;
    @MockitoBean
    private AiChatService aiChatService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp(RestDocumentationContextProvider restDocumentation) {
        mockMvc = webAppContextSetup(context).apply(springSecurity())
                .apply(documentationConfiguration(restDocumentation)).build();
    }

    @Test
    void sendsChunksBeforeCompletionAndDocumentsTheSseContract() throws Exception {
        var source = new AtomicReference<ChatReplyHandler>();
        var finished = new CountDownLatch(1);
        doAnswer(invocation -> {
            ChatReplyHandler reply = invocation.getArgument(3);
            reply.conversation(ID);
            source.set(reply);
            finished.await();
            return null;
        }).when(aiChatService).chat(eq(7L), any(), eq("다음 준비를 알려줘"), any(ChatReplyHandler.class));
        var initial = mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(7L))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ChatRequest(null, "다음 준비를 알려줘"))))
                .andExpect(request().asyncStarted()).andReturn();
        await().until(() -> source.get() != null);
        await().until(() -> initial.getResponse().getContentAsString(StandardCharsets.UTF_8).contains("event:conversation"));
        assertThat(initial.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .contains("event:conversation", "\"conversationId\":\"" + ID + "\"").doesNotContain("event:done");

        source.get().delta("웨딩홀 ");
        assertThat(initial.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .contains("event:delta", "\"text\":\"웨딩홀 \"").doesNotContain("event:done");
        source.get().delta("계약을 확인하세요.");
        source.get().complete(new ChatResult(ID, "웨딩홀 계약을 확인하세요."), () -> {});
        finished.countDown();

        var completed = mockMvc.perform(asyncDispatch(initial))
                .andExpect(status().isOk()).andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM))
                .andDo(document("ai-chat-stream",
                        preprocessRequest(modifyHeaders().set("Authorization", "Bearer <access-token>")),
                        preprocessResponse(), resource(ResourceSnippetParameters.builder()
                        .tag("AI Chat").summary("결혼 준비 AI 대화")
                        .description("인증된 POST SSE 응답입니다. conversation {conversationId} 이후 "
                                + "delta {text}를 순서대로 이어 붙이고, done {conversationId}에서 정상 완료합니다. "
                                + "스트림 시작 후 오류는 failure {message}로 끝납니다. done 없이 끊긴 답변은 미완료입니다. "
                                + "전체 제한 시간은 기본 30초이며 조각 도착으로 연장하지 않습니다. "
                                + "같은 대화의 동시 요청은 failure로 종료합니다.")
                        .requestSchema(schema("ChatRequest"))
                        .responseSchema(schema("ChatEventStream"))
                        .requestHeaders(headerWithName("Authorization").description("로그인 access token. Bearer 인증"))
                        .requestFields(fieldWithPath("conversationId").type(JsonFieldType.STRING).optional().description("이전 대화 UUID 문자열. 생략 또는 null이면 서버에서 생성"),
                                fieldWithPath("message").description("사용자 메시지. 공백 제외 필수, 최대 4000자"))
                        .build()))).andReturn();
        String body = completed.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).containsSubsequence("event:conversation", "event:delta", "웨딩홀 ", "event:delta", "계약을 확인하세요.", "event:done")
                .doesNotContain("event:failure");
    }

    @Test
    void streamErrorsSendOnlyTheFixedPublicMessageAndNeverDone() throws Exception {
        doAnswer(invocation -> {
            ChatReplyHandler reply = invocation.getArgument(3);
            reply.conversation(ID);
            reply.delta("일부 답변");
            throw new IllegalStateException("외부 API 비밀 원문");
        }).when(aiChatService).chat(eq(7L), any(), any(), any(ChatReplyHandler.class));
        var initial = mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(7L)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ChatRequest(UUID.fromString(ID), "질문"))))
                .andExpect(request().asyncStarted()).andReturn();
        initial.getAsyncResult(5000);
        var completed = mockMvc.perform(asyncDispatch(initial)).andExpect(status().isOk())
                .andDo(document("ai-chat-failure", resource(ResourceSnippetParameters.builder().tag("AI Chat")
                        .summary("AI 대화 생성 실패").description("SSE 시작 이후의 공개 실패 이벤트. 이후 done을 보내지 않습니다.")
                        .responseSchema(schema("ChatEventStream"))
                        .build()))).andReturn();
        assertThat(completed.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .contains("event:failure", ClientError.INTERNAL_ERROR.message()).doesNotContain("비밀", "event:done");
    }

    @Test
    void disconnectedClientInterruptsTheResponseWorker() throws Exception {
        var started = new CountDownLatch(1);
        var cancelled = new AtomicBoolean();
        doAnswer(invocation -> {
            ChatReplyHandler reply = invocation.getArgument(3);
            reply.conversation(ID);
            started.countDown();
            try {
                new CountDownLatch(1).await();
            } catch (InterruptedException exception) {
                cancelled.set(true);
                throw exception;
            }
            return null;
        }).when(aiChatService).chat(eq(7L), any(), any(), any(ChatReplyHandler.class));
        var result = mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(7L)).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ChatRequest(UUID.fromString(ID), "질문")))).andReturn();
        await().until(() -> started.getCount() == 0);
        var event = new jakarta.servlet.AsyncEvent(result.getRequest().getAsyncContext());
        for (var listener : ((org.springframework.mock.web.MockAsyncContext) event.getAsyncContext()).getListeners()) {
            listener.onError(event);
        }
        await().untilTrue(cancelled);
        assertThat(result.getResponse().getContentAsString()).doesNotContain("event:done");
    }

    @Test
    void servletTimeoutInterruptsTheWorkerWithoutSendingLateEvents() throws Exception {
        var source = new AtomicReference<ChatReplyHandler>();
        var cancelled = new AtomicBoolean();
        doAnswer(invocation -> {
            ChatReplyHandler reply = invocation.getArgument(3);
            reply.conversation(ID);
            source.set(reply);
            try {
                new CountDownLatch(1).await();
            } catch (InterruptedException exception) {
                cancelled.set(true);
                throw exception;
            }
            return null;
        }).when(aiChatService).chat(eq(7L), any(), any(), any(ChatReplyHandler.class));
        var initial = mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(7L)).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ChatRequest(UUID.fromString(ID), "질문")))).andReturn();
        await().until(() -> source.get() != null);
        var event = new jakarta.servlet.AsyncEvent(initial.getRequest().getAsyncContext());
        var listeners = ((org.springframework.mock.web.MockAsyncContext) event.getAsyncContext()).getListeners();
        for (var listener : listeners) {
            listener.onTimeout(event);
        }
        assertThatThrownBy(() -> source.get().delta("늦은 답변")).isInstanceOf(CancellationException.class);
        await().untilTrue(cancelled);
        String body = mockMvc.perform(asyncDispatch(initial)).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).doesNotContain("늦은 답변", "event:done", "event:delta");
    }

    @Test
    void unauthenticatedRequestsFailBeforeStreaming() throws Exception {
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
    void pendingUsersCannotStartTheStream() throws Exception {
        mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(7L, UserStatus.PENDING)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ChatRequest(null, "질문"))))
                .andExpect(status().isForbidden()).andExpect(request().asyncNotStarted());
        verifyNoInteractions(aiChatService);
    }

    @Test
    void convertsTheConversationIdToUuidBeforeCallingTheService() throws Exception {
        UUID id = UUID.fromString(ID);
        doAnswer(invocation -> {
            ChatReplyHandler reply = invocation.getArgument(3);
            reply.conversation(ID);
            reply.complete(new ChatResult(ID, "답변"), () -> {});
            return null;
        }).when(aiChatService).chat(eq(7L), eq(id), eq("질문"), any(ChatReplyHandler.class));
        ObjectNode request = (ObjectNode) objectMapper.valueToTree(new ChatRequest(id, "질문"));
        request.put("conversationId", ID.toUpperCase(java.util.Locale.ROOT));

        var initial = mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(7L)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(request().asyncStarted()).andReturn();
        initial.getAsyncResult(5000);
        var completed = mockMvc.perform(asyncDispatch(initial)).andExpect(status().isOk()).andReturn();

        verify(aiChatService).chat(eq(7L), eq(id), eq("질문"), any(ChatReplyHandler.class));
        assertThat(completed.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .contains("event:done").doesNotContain("event:failure");
    }

    @ParameterizedTest
    @ValueSource(strings = {"invalid", "7bf4d204-8331-439b-bd8f-271abc0eea9z"})
    void malformedUuidFailsBeforeStreaming(String conversationId) throws Exception {
        ObjectNode request = (ObjectNode) objectMapper.valueToTree(new ChatRequest(null, "질문"));
        request.put("conversationId", conversationId);

        mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(7L)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest()).andExpect(request().asyncNotStarted())
                .andExpect(jsonPath("$.errorCode").value(ClientError.INVALID_REQUEST.errorCode()));
        verifyNoInteractions(aiChatService);
    }

    @ParameterizedTest
    @MethodSource("invalidRequests")
    void invalidInputFailsBeforeStreaming(ChatRequest request) throws Exception {
        mockMvc.perform(post("/api/ai/chat").with(authenticatedUser(7L)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest()).andExpect(request().asyncNotStarted())
                .andExpect(jsonPath("$.errorCode").value(ClientError.INVALID_REQUEST.errorCode()));
        verifyNoInteractions(aiChatService);
    }

    static java.util.stream.Stream<ChatRequest> invalidRequests() {
        return java.util.stream.Stream.of(new ChatRequest(null, " "), new ChatRequest(null, null),
                new ChatRequest(null, "가".repeat(4001)));
    }
}

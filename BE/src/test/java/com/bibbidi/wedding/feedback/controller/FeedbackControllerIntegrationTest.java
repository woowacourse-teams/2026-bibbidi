package com.bibbidi.wedding.feedback.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.assertj.core.api.Assertions.assertThat;
import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.documentationConfiguration;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;

import com.bibbidi.wedding.feedback.controller.dto.CreateFeedbackRequest;
import com.bibbidi.wedding.feedback.client.DiscordApiClient;
import com.bibbidi.wedding.feedback.client.DiscordMessageDto;
import java.net.URI;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.restdocs.RestDocumentationContextProvider;
import org.springframework.restdocs.RestDocumentationExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;

@SpringBootTest
@ActiveProfiles("test")
@ExtendWith(RestDocumentationExtension.class)
class FeedbackControllerIntegrationTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private DiscordApiClient discordApiClient;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp(RestDocumentationContextProvider restDocumentation) {
        mockMvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(documentationConfiguration(restDocumentation))
                .build();
    }

    @Test
    @DisplayName("인증 없이 피드백을 생성한다")
    void shouldCreateFeedbackWithoutAuthentication() throws Exception {
        mockMvc.perform(post("/api/feedbacks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateFeedbackRequest("good", "feedback content"))))
                .andExpect(status().isCreated())
                .andExpect(content().string(""))
                .andDo(document(
                        "feedbacks-create",
                        resource(ResourceSnippetParameters.builder()
                                .tag("Feedback")
                                .summary("피드백 생성")
                                .description("로그인 없이 준비 목록에 대한 피드백을 저장합니다.")
                                .requestSchema(schema("CreateFeedbackRequest"))
                                .requestFields(
                                        fieldWithPath("sentiment")
                                                .description("피드백 감정. good 또는 bad 중 하나"),
                                        fieldWithPath("content")
                                                .description("선택 피드백 본문. 최대 255자")
                                                .optional()
                                )
                                .build())
                ));

    }

    @Test
    @DisplayName("본문 없이 피드백을 생성한다")
    void shouldCreateFeedbackWithoutContent() throws Exception {
        mockMvc.perform(post("/api/feedbacks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateFeedbackRequest("bad", null))))
                .andExpect(status().isCreated())
                .andExpect(content().string(""));
    }

    @Test
    @DisplayName("지원하지 않는 sentiment를 거절한다")
    void shouldRejectInvalidSentiment() throws Exception {
        mockMvc.perform(post("/api/feedbacks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateFeedbackRequest("unknown", null))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("255자를 초과하는 본문을 거절한다")
    void shouldRejectFeedbackWithContentLongerThan255Characters() throws Exception {
        String content = "가".repeat(256);

        mockMvc.perform(post("/api/feedbacks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateFeedbackRequest("good", content))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Discord 알림 전송이 요청 스레드를 점유하지 않는다")
    void shouldNotBlockRequestThreadWithDiscordNotification() throws Exception {
        CountDownLatch release = new CountDownLatch(1);
        doAnswer(invocation -> {
            release.await(2, TimeUnit.SECONDS);
            return null;
        }).when(discordApiClient).sendMessage(any(URI.class), any(DiscordMessageDto.class));

        long startedAt = System.nanoTime();

        mockMvc.perform(post("/api/feedbacks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateFeedbackRequest("good", null))))
                .andExpect(status().isCreated());

        long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
        assertThat(elapsedMillis).isLessThan(1_000L);

        verify(discordApiClient, org.mockito.Mockito.timeout(1_000))
                .sendMessage(any(URI.class), any(DiscordMessageDto.class));
        release.countDown();
    }

}

package com.bibbidi.wedding.feedback.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.feedback.client.DiscordApiClient;
import com.bibbidi.wedding.feedback.client.DiscordMessageDto;
import com.bibbidi.wedding.feedback.controller.dto.CreateFeedbackRequest;
import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import java.net.URI;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Transactional(propagation = Propagation.NOT_SUPPORTED)
class FeedbackControllerIntegrationTest extends BibbidiIntegrationTest {

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private DiscordApiClient discordApiClient;

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
        doAnswer(invocation -> {
            assertThat(Thread.currentThread().getName()).startsWith("discord-");
            return null;
        }).when(discordApiClient).sendMessage(any(URI.class), any(DiscordMessageDto.class));

        mockMvc.perform(post("/api/feedbacks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateFeedbackRequest("good", null))))
                .andExpect(status().isCreated());

        verify(discordApiClient, timeout(1_000))
                .sendMessage(any(URI.class), any(DiscordMessageDto.class));
    }

}

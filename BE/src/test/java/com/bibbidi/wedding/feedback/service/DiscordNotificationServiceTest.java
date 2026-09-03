package com.bibbidi.wedding.feedback.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.bibbidi.wedding.feedback.client.DiscordApiClient;
import com.bibbidi.wedding.feedback.client.DiscordMessageDto;
import com.bibbidi.wedding.feedback.domain.Feedback;
import com.bibbidi.wedding.feedback.domain.Sentiment;
import com.bibbidi.wedding.feedback.event.FeedbackCreatedEvent;
import java.net.URI;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class DiscordNotificationServiceTest {

    private final DiscordApiClient discordApiClient = mock(DiscordApiClient.class);

    @Test
    @DisplayName("피드백 생성 이벤트를 Discord 웹훅으로 전송한다")
    void shouldSendFeedbackToDiscord() {
        DiscordNotificationService service = new DiscordNotificationService(
                discordApiClient,
                "https://discord.test/webhook"
        );
        Feedback feedback = new Feedback(Sentiment.GOOD, "feedback");

        service.notify(new FeedbackCreatedEvent(feedback));

        verify(discordApiClient).sendMessage(
                eq(URI.create("https://discord.test/webhook")),
                eq(DiscordMessageDto.from(feedback))
        );
    }

    @Test
    @DisplayName("Discord 웹훅 URL이 없으면 전송하지 않는다")
    void shouldSkipWhenWebhookUrlIsNotConfigured() {
        DiscordNotificationService service = new DiscordNotificationService(discordApiClient, "");

        service.notify(new FeedbackCreatedEvent(new Feedback(Sentiment.BAD, null)));

        verifyNoInteractions(discordApiClient);
    }

    @Test
    @DisplayName("Discord 전송 실패가 예외로 전파되지 않는다")
    void shouldHandleDiscordFailure() {
        DiscordNotificationService service = new DiscordNotificationService(
                discordApiClient,
                "https://discord.test/webhook"
        );
        doThrow(new IllegalStateException("discord failure"))
                .when(discordApiClient)
                .sendMessage(any(), any());

        service.notify(new FeedbackCreatedEvent(new Feedback(Sentiment.BAD, "feedback")));

        verify(discordApiClient).sendMessage(
                eq(URI.create("https://discord.test/webhook")),
                any(DiscordMessageDto.class)
        );
    }
}

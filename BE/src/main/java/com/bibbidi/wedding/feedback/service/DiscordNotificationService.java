package com.bibbidi.wedding.feedback.service;

import com.bibbidi.wedding.feedback.client.DiscordApiClient;
import com.bibbidi.wedding.feedback.client.DiscordMessageDto;
import com.bibbidi.wedding.feedback.domain.Feedback;
import com.bibbidi.wedding.feedback.event.FeedbackCreatedEvent;
import java.net.URI;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Service
@Slf4j
public class DiscordNotificationService {

    private final DiscordApiClient discordApiClient;
    private final String feedbackWebHookUrl;

    public DiscordNotificationService(
            DiscordApiClient discordApiClient,
            @Value("${discord.url.feedback:}") String feedbackWebHookUrl
    ) {
        this.discordApiClient = discordApiClient;
        this.feedbackWebHookUrl = feedbackWebHookUrl;
    }

    @Async("discordExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void notify(FeedbackCreatedEvent event) {
        Feedback feedback = event.feedback();
        if (feedbackWebHookUrl.isBlank()) {
            log.error("Discord 피드백 웹훅 URL이 설정되지 않아 알림을 건너뜁니다.");
            return;
        }

        try {
            discordApiClient.sendMessage(URI.create(feedbackWebHookUrl), DiscordMessageDto.from(feedback));
            log.info("Discord 피드백 알림 전송 성공");
        } catch (Exception exception) {
            log.error("Discord 피드백 알림 전송 실패", exception);
        }
    }
}

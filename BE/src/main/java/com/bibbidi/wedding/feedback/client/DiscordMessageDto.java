package com.bibbidi.wedding.feedback.client;

import com.bibbidi.wedding.feedback.domain.Feedback;
import com.bibbidi.wedding.feedback.domain.Sentiment;

public record DiscordMessageDto(String content) {

    public static DiscordMessageDto from(Feedback feedback) {
        String sentiment = feedback.sentiment() == Sentiment.GOOD ? "좋았어요" : "아쉬워요";
        String content = feedback.content() == null ? "(내용 없음)" : feedback.content();

        String message = """
                [🪧사용자 피드백]
                감정: %s
                내용:
                %s
                """.formatted(sentiment, content);

        return new DiscordMessageDto(message);
    }
}

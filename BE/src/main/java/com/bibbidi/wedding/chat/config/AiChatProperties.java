package com.bibbidi.wedding.chat.config;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("bibbidi.ai")
public record AiChatProperties(
        @NotNull Duration responseTimeout,
        @Min(2) int memoryMaxMessages
) {

    @AssertTrue(message = "응답 제한 시간은 1밀리초 이상이어야 합니다.")
    public boolean isResponseTimeoutPositive() {
        return responseTimeout != null && responseTimeout.toMillis() > 0;
    }
}

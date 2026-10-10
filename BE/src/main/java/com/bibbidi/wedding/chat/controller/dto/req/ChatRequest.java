package com.bibbidi.wedding.chat.controller.dto.req;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record ChatRequest(
        @Nullable UUID conversationId,
        @NotBlank @Size(max = 4000) String message
) {
}

package com.bibbidi.wedding.chat.service.dto.result;

import java.util.List;

public record ChatAnswer(
        String answer,
        List<Long> recommendedItemIds
) {
}

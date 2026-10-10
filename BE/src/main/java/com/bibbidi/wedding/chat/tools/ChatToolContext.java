package com.bibbidi.wedding.chat.tools;

import java.util.Map;
import org.springframework.ai.chat.model.ToolContext;

public record ChatToolContext(Long userId) {

    private static final String USER_ID = "authenticatedUserId";

    public Map<String, Object> toMap() {
        return Map.of(USER_ID, userId);
    }

    public static ChatToolContext from(ToolContext context) {
        if (!(context.getContext().get(USER_ID) instanceof Long userId)) {
            throw new IllegalStateException("개인 조회 도구에 인증 사용자 정보가 없습니다.");
        }
        return new ChatToolContext(userId);
    }
}

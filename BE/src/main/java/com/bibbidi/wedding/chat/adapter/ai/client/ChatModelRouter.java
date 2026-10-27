package com.bibbidi.wedding.chat.adapter.ai.client;

import com.bibbidi.wedding.chat.adapter.ai.routing.ChatModelTier;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.Map;

public final class ChatModelRouter {

    private final Map<ChatModelTier, ChatModelTarget> targets;

    public ChatModelRouter(Map<ChatModelTier, ChatModelTarget> targets) {
        this.targets = Map.copyOf(targets);
    }

    public ChatModelTarget route(ChatModelTier tier) {
        ChatModelTarget target = targets.get(tier);
        if (target == null) {
            throw new BusinessException(ClientError.INTERNAL_ERROR, "모델 호출 대상이 없습니다. tier=" + tier);
        }
        return target;
    }
}

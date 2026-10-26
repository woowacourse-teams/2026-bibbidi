package com.bibbidi.wedding.chat.adapter.ai.client;

import com.bibbidi.wedding.chat.adapter.ai.routing.ChatModelTier;
import java.util.Map;

public final class ChatModelRouter {

    private final Map<ChatModelTier, ChatModelRoute> routes;

    public ChatModelRouter(Map<ChatModelTier, ChatModelRoute> routes) {
        this.routes = Map.copyOf(routes);
    }

    public ChatModelRoute route(ChatModelTier tier) {
        ChatModelRoute route = routes.get(tier);
        if (route == null) {
            throw new IllegalStateException("모델 경로가 없습니다. tier=" + tier);
        }
        return route;
    }
}

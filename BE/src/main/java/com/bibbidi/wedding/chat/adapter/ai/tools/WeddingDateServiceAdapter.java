package com.bibbidi.wedding.chat.adapter.ai.tools;

import com.bibbidi.wedding.chat.adapter.ai.client.SpringAiChatClient;
import com.bibbidi.wedding.user.service.UserService;
import com.bibbidi.wedding.user.service.WeddingDateResult;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

@Component
public class WeddingDateServiceAdapter {

    private final UserService userService;

    public WeddingDateServiceAdapter(UserService userService) {
        this.userService = userService;
    }

    @Tool(
            name = "getMyWeddingDate",
            description = "대화 중인 사용자의 결혼 날짜를 조회한다. weddingDate가 null이면 아직 날짜를 등록하지 않은 사용자다. "
                    + "결혼까지 남은 기간이나 준비 시기를 답할 때 호출한다."
    )
    public WeddingDateResult getMyWeddingDate(ToolContext toolContext) {
        return userService.findWeddingDate(SpringAiChatClient.userIdOf(toolContext));
    }
}

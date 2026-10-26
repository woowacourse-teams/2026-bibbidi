package com.bibbidi.wedding.chat.adapter.ai.tools;

import com.bibbidi.wedding.chat.adapter.ai.client.SpringAiChatClient;
import com.bibbidi.wedding.chat.service.dto.checklist.ChecklistSnapshot;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

@Component
public class ChecklistServiceAdapter {

    private final ChecklistService checklistService;

    public ChecklistServiceAdapter(ChecklistService checklistService) {
        this.checklistService = checklistService;
    }

    @Tool(
            name = "getMyChecklist",
            description = "대화 중인 사용자의 체크리스트를 조회한다. exists가 false이면 체크리스트를 아직 만들지 않은 사용자다. 사용자의 준비 상태와 일정을 답할 때 호출한다."
    )
    public ChecklistSnapshot getMyChecklist(ToolContext toolContext) {
        return ChecklistSnapshot.of(checklistService.findMyChecklistIfPresent(
                SpringAiChatClient.userIdOf(toolContext)));
    }
}

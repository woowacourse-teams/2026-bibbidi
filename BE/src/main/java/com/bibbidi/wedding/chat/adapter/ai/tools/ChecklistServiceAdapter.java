package com.bibbidi.wedding.chat.adapter.ai.tools;

import com.bibbidi.wedding.chat.adapter.ai.client.SpringAiChatClient;
import com.bibbidi.wedding.chat.service.dto.checklist.ChecklistSnapshot;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemResult;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

@Component
public class ChecklistServiceAdapter {

    private static final String CONFIRM_FIRST = "사용자에게 바꿀 내용을 알리고 진행할지 물은 뒤, "
            + "사용자가 다음 메시지에서 동의했을 때만 호출한다. getMyChecklist로 확인한 id만 쓴다.";

    private final ChecklistService checklistService;

    public ChecklistServiceAdapter(ChecklistService checklistService) {
        this.checklistService = checklistService;
    }

    @Tool(
            name = "getMyChecklist",
            description = "대화 중인 사용자의 체크리스트를 조회한다. exists가 false이면 체크리스트를 아직 만들지 않은 사용자다. 사용자의 준비 상태와 일정을 답할 때 호출한다."
    )
    public ChecklistSnapshot getMyChecklist(ToolContext toolContext) {
        return ChecklistSnapshot.of(
                checklistService.findMyChecklistIfPresent(
                        SpringAiChatClient.userIdOf(toolContext))
        );
    }

    @Tool(
            name = "changeChecklistItemStatus",
            description = "사용자의 할 일 상태를 바꾼다. " + CONFIRM_FIRST
    )
    public ChecklistItemResult changeItemStatus(
            @ToolParam(description = "할 일 id") Long checklistItemId,
            @ToolParam(description = "새 상태. prev(시작 전), continue(진행 중), done(완료) 중 하나") String status,
            ToolContext toolContext
    ) {
        return checklistService.changeItemStatus(
                SpringAiChatClient.userIdOf(toolContext),
                checklistItemId,
                status
        );
    }

    @Tool(
            name = "changeChecklistItemTitle",
            description = "사용자의 할 일 이름을 바꾼다. " + CONFIRM_FIRST
    )
    public ChecklistItemResult changeItemTitle(
            @ToolParam(description = "할 일 id") Long checklistItemId,
            @ToolParam(description = "새 이름") String title,
            ToolContext toolContext
    ) {
        return checklistService.changeItemTitle(
                SpringAiChatClient.userIdOf(toolContext),
                checklistItemId,
                title
        );
    }

    @Tool(
            name = "deleteChecklistItem",
            description = "사용자의 할 일을 삭제한다. 그 할 일에 붙은 일정도 함께 삭제되므로 이를 알려야 한다. " + CONFIRM_FIRST
    )
    public void deleteItem(
            @ToolParam(description = "할 일 id") Long checklistItemId,
            ToolContext toolContext
    ) {
        checklistService.deleteItem(
                SpringAiChatClient.userIdOf(toolContext), checklistItemId
        );
    }
}

package com.bibbidi.wedding.chat.tools;

import com.bibbidi.wedding.chat.tools.dto.ChecklistToolResponse;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;

public class ChecklistTools {

    private final ChecklistService checklistService;

    public ChecklistTools(ChecklistService checklistService) {
        this.checklistService = checklistService;
    }

    @Tool(description = "현재 로그인한 사용자의 체크리스트와 연결된 일정을 조회한다. exists=false이면 체크리스트가 없다.")
    public ChecklistToolResponse findMyChecklist(ToolContext context) {
        Long userId = ChatToolContext.from(context).userId();
        try {
            ChecklistWithAppointmentsResult result = checklistService.findMyChecklist(userId);
            return ChecklistToolResponse.from(result);
        } catch (BusinessException exception) {
            if (exception.clientError() == ClientError.CHECKLIST_NOT_FOUND) {
                return ChecklistToolResponse.notFound();
            }
            throw exception;
        }
    }
}

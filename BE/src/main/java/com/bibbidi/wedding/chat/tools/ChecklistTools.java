package com.bibbidi.wedding.chat.tools;

import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistAppointmentResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;

public class ChecklistTools {

    public static final String USER_ID = "authenticatedUserId";

    private final ChecklistService checklistService;

    public ChecklistTools(ChecklistService checklistService) {
        this.checklistService = checklistService;
    }

    @Tool(description = "현재 로그인한 사용자의 체크리스트와 연결된 일정을 조회한다. exists=false이면 체크리스트가 없다.")
    public ChecklistDetails findMyChecklist(ToolContext context) {
        if (!(context.getContext().get(USER_ID) instanceof Long userId)) {
            throw new IllegalStateException("개인 조회 도구에 인증 사용자 정보가 없습니다.");
        }
        try {
            var result = checklistService.findMyChecklist(userId);
            return new ChecklistDetails(true, result.items().stream()
                    .map(item -> new Item(item.id(), item.sourceCatalogItemId(), item.title(), item.statusValue(),
                            item.appointments()))
                    .toList());
        } catch (BusinessException exception) {
            if (exception.clientError() == ClientError.CHECKLIST_NOT_FOUND) {
                return new ChecklistDetails(false, List.of());
            }
            throw exception;
        }
    }

    public record ChecklistDetails(boolean exists, List<Item> items) {
    }

    public record Item(Long id, Long catalogItemId, String title, String status,
                       List<ChecklistAppointmentResult> appointments) {
    }
}

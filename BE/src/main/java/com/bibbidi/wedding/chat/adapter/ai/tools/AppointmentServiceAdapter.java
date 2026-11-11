package com.bibbidi.wedding.chat.adapter.ai.tools;

import com.bibbidi.wedding.chat.adapter.ai.client.SpringAiChatClient;
import com.bibbidi.wedding.checklist.service.AppointmentService;
import com.bibbidi.wedding.checklist.service.dto.AppointmentCompletionCommand;
import com.bibbidi.wedding.checklist.service.dto.AppointmentCompletionResult;
import com.bibbidi.wedding.checklist.service.dto.AppointmentCreationCommand;
import com.bibbidi.wedding.checklist.service.dto.AppointmentResult;
import com.bibbidi.wedding.checklist.service.dto.AppointmentUpdateCommand;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

@Component
public class AppointmentServiceAdapter {

    private static final String CONFIRM_FIRST = "사용자에게 바꿀 내용을 알리고 진행할지 물은 뒤, "
            + "사용자가 다음 메시지에서 동의했을 때만 호출한다. getMyChecklist로 확인한 id만 쓴다.";

    private final AppointmentService appointmentService;

    public AppointmentServiceAdapter(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @Tool(
            name = "createAppointment",
            description = "사용자의 할 일에 일정을 추가한다. 결과의 conflicts가 비어 있지 않으면 시간이 겹치는 일정이 있다고 알린다. "
                    + CONFIRM_FIRST
    )
    public AppointmentResult create(
            @ToolParam(description = "일정을 붙일 할 일 id") Long checklistItemId,
            @ToolParam(description = "일정 제목") String title,
            @ToolParam(description = "일정 날짜. yyyy-MM-dd") LocalDate date,
            @ToolParam(description = "시작 시각. yyyy-MM-ddTHH:mm", required = false) LocalDateTime startTime,
            @ToolParam(description = "종료 시각. yyyy-MM-ddTHH:mm", required = false) LocalDateTime endTime,
            @ToolParam(description = "장소", required = false) String place,
            @ToolParam(description = "메모", required = false) String memo,
            ToolContext toolContext
    ) {
        SpringAiChatClient.markWriteAttempt(toolContext);
        AppointmentResult result = appointmentService.create(
                new AppointmentCreationCommand(
                        SpringAiChatClient.userIdOf(toolContext),
                        checklistItemId,
                        title,
                        date,
                        startTime,
                        endTime,
                        place,
                        memo
                )
        );
        SpringAiChatClient.markWriteSucceeded(toolContext);
        return result;
    }

    @Tool(
            name = "updateAppointment",
            description = "사용자의 일정을 수정한다. 바꾸지 않는 값도 현재 값을 그대로 넘긴다. 결과의 conflicts가 비어 있지 않으면 "
                    + "시간이 겹치는 일정이 있다고 알린다. " + CONFIRM_FIRST
    )
    public AppointmentResult update(
            @ToolParam(description = "일정 id") Long appointmentId,
            @ToolParam(description = "일정 제목") String title,
            @ToolParam(description = "일정 날짜. yyyy-MM-dd") LocalDate date,
            @ToolParam(description = "시작 시각. yyyy-MM-ddTHH:mm", required = false) LocalDateTime startTime,
            @ToolParam(description = "종료 시각. yyyy-MM-ddTHH:mm", required = false) LocalDateTime endTime,
            @ToolParam(description = "장소", required = false) String place,
            @ToolParam(description = "메모", required = false) String memo,
            ToolContext toolContext
    ) {
        SpringAiChatClient.markWriteAttempt(toolContext);
        AppointmentResult result = appointmentService.update(
                new AppointmentUpdateCommand(
                        appointmentId,
                        SpringAiChatClient.userIdOf(toolContext),
                        title,
                        date,
                        startTime,
                        endTime,
                        place,
                        memo
                )
        );
        SpringAiChatClient.markWriteSucceeded(toolContext);
        return result;
    }

    @Tool(
            name = "changeAppointmentDone",
            description = "사용자의 일정을 완료하거나 완료를 취소한다. " + CONFIRM_FIRST
    )
    public AppointmentCompletionResult changeStatus(
            @ToolParam(description = "일정 id") Long appointmentId,
            @ToolParam(description = "완료하면 true, 완료를 취소하면 false") boolean isDone,
            ToolContext toolContext
    ) {
        SpringAiChatClient.markWriteAttempt(toolContext);
        AppointmentCompletionResult result = appointmentService.changeStatus(
                AppointmentCompletionCommand.fromRequest(
                        appointmentId,
                        SpringAiChatClient.userIdOf(toolContext),
                        isDone
                )
        );
        SpringAiChatClient.markWriteSucceeded(toolContext);
        return result;
    }

    @Tool(
            name = "deleteAppointment",
            description = "사용자의 일정을 삭제한다. " + CONFIRM_FIRST
    )
    public void delete(
            @ToolParam(description = "일정 id") Long appointmentId,
            ToolContext toolContext
    ) {
        SpringAiChatClient.markWriteAttempt(toolContext);
        appointmentService.delete(
                SpringAiChatClient.userIdOf(toolContext),
                appointmentId
        );
        SpringAiChatClient.markWriteSucceeded(toolContext);
    }
}

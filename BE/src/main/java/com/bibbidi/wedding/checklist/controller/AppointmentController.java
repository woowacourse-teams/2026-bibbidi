package com.bibbidi.wedding.checklist.controller;

import com.bibbidi.wedding.checklist.controller.dto.req.CreateAppointmentRequest;
import com.bibbidi.wedding.checklist.controller.dto.req.UpdateAppointmentRequest;
import com.bibbidi.wedding.checklist.controller.dto.resp.AppointmentCompletionResponse;
import com.bibbidi.wedding.checklist.controller.dto.resp.AppointmentResponse;
import com.bibbidi.wedding.checklist.service.AppointmentService;
import com.bibbidi.wedding.checklist.service.dto.AppointmentCompletionCommand;
import com.bibbidi.wedding.checklist.service.dto.AppointmentCompletionResult;
import com.bibbidi.wedding.checklist.service.dto.AppointmentCreationCommand;
import com.bibbidi.wedding.checklist.service.dto.AppointmentCreationResult;
import com.bibbidi.wedding.checklist.service.dto.AppointmentUpdateCommand;
import com.bibbidi.wedding.checklist.service.dto.AppointmentUpdateResult;
import com.bibbidi.wedding.common.auth.Auth;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AppointmentController {

    private final AppointmentService appointmentService;

    public AppointmentController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/api/checklist-items/{checklistItemId}/appointments")
    public AppointmentResponse create(
            @Auth Long userId,
            @PathVariable Long checklistItemId,
            @Valid @RequestBody CreateAppointmentRequest request
    ) {
        AppointmentCreationCommand command = AppointmentCreationCommand.fromRequest(userId, checklistItemId, request);
        AppointmentCreationResult result = appointmentService.create(command);
        return AppointmentResponse.from(result);
    }

    @PutMapping("/api/appointments/{appointmentId}")
    public AppointmentResponse update(
            @Auth Long userId,
            @PathVariable Long appointmentId,
            @Valid @RequestBody UpdateAppointmentRequest request
    ) {
        AppointmentUpdateCommand command = AppointmentUpdateCommand.fromRequest(appointmentId, userId, request);
        AppointmentUpdateResult result = appointmentService.update(command);
        return AppointmentResponse.from(result);
    }

    @PutMapping("/api/appointments/{appointmentId}/complete")
    public AppointmentCompletionResponse changeCompletion(
            @Auth Long userId,
            @PathVariable Long appointmentId,
            @Valid @RequestBody @NotNull(message = "완료 여부는 필수입니다.") Boolean isDone
    ) {
        AppointmentCompletionCommand command = AppointmentCompletionCommand.fromRequest(
                appointmentId,
                userId,
                isDone
        );
        AppointmentCompletionResult result = appointmentService.changeStatus(command);
        return AppointmentCompletionResponse.from(result);
    }

    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/api/appointments/{appointmentId}")
    public void delete(
            @Auth Long userId,
            @PathVariable Long appointmentId
    ) {
        appointmentService.delete(userId, appointmentId);
    }
}

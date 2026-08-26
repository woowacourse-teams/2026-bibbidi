package com.bibbidi.wedding.appointment.controller;

import com.bibbidi.wedding.appointment.controller.dto.AppointmentResponse;
import com.bibbidi.wedding.appointment.controller.dto.CreateAppointmentRequest;
import com.bibbidi.wedding.appointment.service.AppointmentService;
import com.bibbidi.wedding.appointment.service.dto.AppointmentCreationCommand;
import com.bibbidi.wedding.appointment.service.dto.AppointmentCreationResult;
import com.bibbidi.wedding.auth.session.Auth;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
    @PostMapping("/api/checklist-items/{itemId}/appointments")
    public AppointmentResponse create(
            @Auth Long userId,
            @PathVariable Long itemId,
            @Valid @RequestBody CreateAppointmentRequest request
    ) {
        AppointmentCreationCommand command = AppointmentCreationCommand.fromRequest(itemId, request);
        AppointmentCreationResult result = appointmentService.create(command);
        return AppointmentResponse.from(result);
    }
}

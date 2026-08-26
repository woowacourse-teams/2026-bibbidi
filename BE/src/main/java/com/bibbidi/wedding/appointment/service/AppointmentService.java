package com.bibbidi.wedding.appointment.service;

import com.bibbidi.wedding.appointment.controller.dto.CreateAppointmentRequest;
import com.bibbidi.wedding.appointment.domain.Appointment;
import com.bibbidi.wedding.appointment.repository.AppointmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;

    public AppointmentService(AppointmentRepository appointmentRepository) {
        this.appointmentRepository = appointmentRepository;
    }

    @Transactional
    public AppointmentCreationResult create(Long itemId, CreateAppointmentRequest request) {
        Appointment appointment = new Appointment(
                null,
                itemId,
                request.title(),
                request.date(),
                request.place(),
                request.memo(),
                false,
                request.startTime(),
                request.endTime()
        );
        Appointment saved = appointmentRepository.save(appointment);
        return new AppointmentCreationResult(
                saved.id(),
                saved.checklistItemId(),
                saved.title(),
                saved.date(),
                saved.startTime(),
                saved.endTime(),
                saved.place(),
                saved.memo(),
                saved.isDone()
        );
    }
}

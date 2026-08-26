package com.bibbidi.wedding.appointment.service;

import com.bibbidi.wedding.appointment.domain.Appointment;
import com.bibbidi.wedding.appointment.repository.AppointmentRepository;
import com.bibbidi.wedding.appointment.service.dto.AppointmentCreationCommand;
import com.bibbidi.wedding.appointment.service.dto.AppointmentCreationResult;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;

    public AppointmentService(AppointmentRepository appointmentRepository) {
        this.appointmentRepository = appointmentRepository;
    }

    @Transactional
    public AppointmentCreationResult create(AppointmentCreationCommand command) {
        Appointment appointment = new Appointment(
                null,
                command.itemId(),
                command.title(),
                command.date(),
                command.startTime(),
                command.endTime(),
                command.place(),
                command.memo(),
                false
        );
        Appointment saved = appointmentRepository.save(appointment);
        return AppointmentCreationResult.fromDomain(saved);
    }
}

package com.bibbidi.wedding.appointment.service;

import com.bibbidi.wedding.appointment.domain.Appointment;
import com.bibbidi.wedding.appointment.repository.AppointmentRepository;
import com.bibbidi.wedding.appointment.service.dto.AppointmentCreationCommand;
import com.bibbidi.wedding.appointment.service.dto.AppointmentCreationResult;
import com.bibbidi.wedding.appointment.service.dto.AppointmentUpdateCommand;
import com.bibbidi.wedding.appointment.service.dto.AppointmentUpdateResult;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final ChecklistService checklistService;

    public AppointmentService(AppointmentRepository appointmentRepository, ChecklistService checklistService) {
        this.appointmentRepository = appointmentRepository;
        this.checklistService = checklistService;
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

    @Transactional
    public AppointmentUpdateResult update(AppointmentUpdateCommand command) {
        Appointment appointment = appointmentRepository.findById(command.appointmentId());
        // TODO : Checklist 소유권자와 비교하는 작업 필요.
        Appointment updated = appointment.update(
                command.title(),
                command.date(),
                command.startTime(),
                command.endTime(),
                command.place(),
                command.memo()
        );
        Appointment saved = appointmentRepository.save(updated);
        return AppointmentUpdateResult.fromDomain(saved);
    }
}

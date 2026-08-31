package com.bibbidi.wedding.appointment.service;

import static java.util.Comparator.comparing;

import com.bibbidi.wedding.appointment.domain.Appointment;
import com.bibbidi.wedding.appointment.repository.AppointmentRepository;
import com.bibbidi.wedding.appointment.service.dto.AppointmentConflict;
import com.bibbidi.wedding.appointment.service.dto.AppointmentCreationCommand;
import com.bibbidi.wedding.appointment.service.dto.AppointmentCreationResult;
import com.bibbidi.wedding.appointment.service.dto.AppointmentUpdateCommand;
import com.bibbidi.wedding.appointment.service.dto.AppointmentUpdateResult;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AppointmentService implements AppointmentDeleteService {

    private final AppointmentRepository appointmentRepository;
    private final ChecklistService checklistService;

    public AppointmentService(AppointmentRepository appointmentRepository, ChecklistService checklistService) {
        this.appointmentRepository = appointmentRepository;
        this.checklistService = checklistService;
    }

    @Transactional
    public AppointmentCreationResult create(AppointmentCreationCommand command) {
        checklistService.validateItemOwnership(command.checklistItemId(), command.userId());

        Appointment appointment = new Appointment(
                null,
                command.checklistItemId(),
                command.title(),
                command.date(),
                command.startTime(),
                command.endTime(),
                command.place(),
                command.memo(),
                false
        );

        Appointment saved = appointmentRepository.save(appointment);
        List<AppointmentConflict> conflicts = findConflictingWithNewAppointment(command.userId(), saved);

        return AppointmentCreationResult
                .fromDomain(saved)
                .withConflicts(conflicts);
    }

    @Transactional
    public AppointmentUpdateResult update(AppointmentUpdateCommand command) {
        Appointment appointment = appointmentRepository.findById(command.appointmentId());
        checklistService.validateItemOwnership(appointment.checklistItemId(), command.userId());

        Appointment updated = appointment.update(
                command.title(),
                command.date(),
                command.startTime(),
                command.endTime(),
                command.place(),
                command.memo()
        );

        Appointment saved = appointmentRepository.save(updated);
        List<AppointmentConflict> conflicts = findConflictingWithNewAppointment(command.userId(), saved);

        return AppointmentUpdateResult.fromDomain(saved)
                .withConflicts(conflicts);
    }

    @Transactional
    public void delete(Long userId, Long appointmentId) {
        Appointment appointment = appointmentRepository.findById(appointmentId);
        checklistService.validateItemOwnership(appointment.checklistItemId(), userId);
        appointmentRepository.deleteById(appointmentId);
    }

    @Override
    @Transactional
    public void changeAllToNewChecklistItemIds(Long newChecklistItemId, List<Long> targetAppointmentIds) {
        if (targetAppointmentIds.isEmpty()) {
            return;
        }
        appointmentRepository.changeAllToNewChecklistItemIds(newChecklistItemId, targetAppointmentIds);
    }

    @Override
    @Transactional
    public void deleteAll(List<Long> targetAppointmentIds) {
        if (targetAppointmentIds.isEmpty()) {
            return;
        }
        appointmentRepository.deleteAll(targetAppointmentIds);
    }

    @Override
    @Transactional
    public void deleteAllByChecklistItemId(Long checklistItemId) {
        appointmentRepository.deleteAllByChecklistItemId(checklistItemId);
    }

    private List<AppointmentConflict> findConflictingWithNewAppointment(Long userId, Appointment savedAppointment) {
        if (!savedAppointment.hasConfirmedSchedule()) {
            return List.of();
        }

        return appointmentRepository.findOverlapCandidates(userId, savedAppointment).stream()
                .filter(candidate -> !candidate.id().equals(savedAppointment.id()))
                .filter(savedAppointment::conflictsWith)
                .sorted(comparing(Appointment::startTime).thenComparing(Appointment::id))
                .map(AppointmentConflict::fromDomain)
                .toList();
    }
}

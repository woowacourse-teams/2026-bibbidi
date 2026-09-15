package com.bibbidi.wedding.checklist.service;

import static java.util.Comparator.comparing;

import com.bibbidi.wedding.checklist.domain.Appointment;
import com.bibbidi.wedding.checklist.repository.AppointmentRepository;
import com.bibbidi.wedding.checklist.service.dto.AppointmentCompletionCommand;
import com.bibbidi.wedding.checklist.service.dto.AppointmentCompletionResult;
import com.bibbidi.wedding.checklist.service.dto.AppointmentConflict;
import com.bibbidi.wedding.checklist.service.dto.AppointmentCreationCommand;
import com.bibbidi.wedding.checklist.service.dto.AppointmentResult;
import com.bibbidi.wedding.checklist.service.dto.AppointmentUpdateCommand;
import java.util.Comparator;
import java.util.List;
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
    public AppointmentResult create(AppointmentCreationCommand command) {
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
                false,
                false
        );

        Appointment saved = appointmentRepository.save(appointment);
        List<AppointmentConflict> conflicts = findConflictingWithNewAppointment(command.userId(), saved);

        return AppointmentResult
                .fromDomain(saved)
                .withConflicts(conflicts);
    }

    @Transactional
    public AppointmentResult update(AppointmentUpdateCommand command) {
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

        return AppointmentResult.fromDomain(saved)
                .withConflicts(conflicts);
    }

    @Transactional
    public AppointmentCompletionResult changeStatus(AppointmentCompletionCommand command) {
        Appointment appointment = appointmentRepository.findById(command.appointmentId());
        checklistService.validateItemOwnership(appointment.checklistItemId(), command.userId());

        Appointment changed = appointment.changeCompletion(command.isDone());
        Appointment saved = appointmentRepository.save(changed);

        boolean checklistItemDone = checklistService.changeItemStatusByAppointment(
                command.userId(),
                saved.checklistItemId(),
                saved.isDone()
        );

        return AppointmentCompletionResult.from(saved, checklistItemDone);
    }

    @Transactional
    public void delete(Long userId, Long appointmentId) {
        Appointment appointment = appointmentRepository.findById(appointmentId);
        checklistService.validateItemOwnership(appointment.checklistItemId(), userId);
        appointmentRepository.deleteById(appointmentId);
    }

    @Transactional(readOnly = true)
    public List<AppointmentResult> findNearby(Long userId, int limit) {
        return appointmentRepository.findNearby(userId).stream()
                .sorted(nearbyOrder())
                .limit(limit)
                .map(AppointmentResult::fromDomain)
                .toList();
    }

    private static Comparator<Appointment> nearbyOrder() {
        return comparing(Appointment::date)
                .thenComparing(Appointment::startTime, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(Appointment::id);
    }

    @Transactional
    public void changeAllToNewChecklistItemIds(Long newChecklistItemId, List<Long> targetAppointmentIds) {
        if (targetAppointmentIds.isEmpty()) {
            return;
        }
        appointmentRepository.changeAllToNewChecklistItemIds(newChecklistItemId, targetAppointmentIds);
    }

    @Transactional
    public void deleteAll(List<Long> targetAppointmentIds) {
        if (targetAppointmentIds.isEmpty()) {
            return;
        }
        appointmentRepository.deleteAll(targetAppointmentIds);
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

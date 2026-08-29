package com.bibbidi.wedding.appointment.service;

import static java.util.Comparator.comparing;

import com.bibbidi.wedding.appointment.domain.Appointment;
import com.bibbidi.wedding.appointment.repository.AppointmentRepository;
import com.bibbidi.wedding.appointment.service.dto.AppointmentConflict;
import com.bibbidi.wedding.appointment.service.dto.AppointmentCreationCommand;
import com.bibbidi.wedding.appointment.service.dto.AppointmentCreationResult;
import com.bibbidi.wedding.appointment.service.dto.AppointmentUpdateCommand;
import com.bibbidi.wedding.appointment.service.dto.AppointmentUpdateResult;
import com.bibbidi.wedding.checklist.service.ChecklistDeletionTarget;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
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
        validateItemOwnership(command.userId(), command.checklistItemId());

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
        validateItemOwnership(command.userId(), appointment.checklistItemId());

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
        validateItemOwnership(userId, appointment.checklistItemId());
        appointmentRepository.deleteById(appointmentId);
    }

    @Transactional
    public void deleteWeddingDataByOwnerId(Long ownerId) {
        checklistService.findDeletionTarget(ownerId)
                .ifPresent(this::deleteWeddingData);
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
    public void deleteAllByChecklistItemIds(List<Long> checklistItemIds) {
        deleteAppointmentsByChecklistItemIds(checklistItemIds);
    }

    private void deleteWeddingData(ChecklistDeletionTarget target) {
        deleteAppointmentsByChecklistItemIds(target.checklistItemIds());
        checklistService.delete(target.checklistId());
    }

    private void deleteAppointmentsByChecklistItemIds(List<Long> checklistItemIds) {
        if (checklistItemIds.isEmpty()) {
            return;
        }
        appointmentRepository.deleteAllByChecklistItemIds(checklistItemIds);
    }

    private void validateItemOwnership(Long userId, Long checklistItemId) {
        if (!checklistService.checkItemOwnership(checklistItemId, userId)) {
            throw new BusinessException(
                    ClientError.CHECKLIST_ITEM_ACCESS_DENIED,
                    "현재 사용자 계정에 속한 할 일이 아닙니다. userId=" + userId
                            + ", checklistItemId=" + checklistItemId
            );
        }
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

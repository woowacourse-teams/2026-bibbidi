package com.bibbidi.wedding.appointment.service;

import com.bibbidi.wedding.appointment.repository.AppointmentRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AppointmentDeletionService implements AppointmentDeleteService {

    private final AppointmentRepository appointmentRepository;

    public AppointmentDeletionService(AppointmentRepository appointmentRepository) {
        this.appointmentRepository = appointmentRepository;
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
        if (checklistItemIds.isEmpty()) {
            return;
        }
        appointmentRepository.deleteAllByChecklistItemIds(checklistItemIds);
    }
}

package com.bibbidi.wedding.appointment.service;

import com.bibbidi.wedding.appointment.repository.AppointmentRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChecklistAppointmentDeleteService {

    private final AppointmentRepository appointmentRepository;

    public ChecklistAppointmentDeleteService(AppointmentRepository appointmentRepository) {
        this.appointmentRepository = appointmentRepository;
    }

    @Transactional
    public void deleteAllByChecklistItemId(Long checklistItemId) {
        appointmentRepository.deleteAllByChecklistItemIds(List.of(checklistItemId));
    }

    @Transactional
    public void deleteAllByChecklistItemIds(List<Long> checklistItemIds) {
        if (checklistItemIds.isEmpty()) {
            return;
        }
        appointmentRepository.deleteAllByChecklistItemIds(checklistItemIds);
    }
}

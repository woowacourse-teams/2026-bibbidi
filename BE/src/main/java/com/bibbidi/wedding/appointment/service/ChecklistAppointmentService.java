package com.bibbidi.wedding.appointment.service;

import com.bibbidi.wedding.appointment.domain.Appointment;
import com.bibbidi.wedding.appointment.repository.AppointmentRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChecklistAppointmentService {

    private final AppointmentRepository appointmentRepository;

    public ChecklistAppointmentService(AppointmentRepository appointmentRepository) {
        this.appointmentRepository = appointmentRepository;
    }

    @Transactional(readOnly = true)
    public boolean hasRemainingAppointment(Long checklistItemId) {
        return appointmentRepository.existsRemainingByChecklistItemId(checklistItemId);
    }

    @Transactional
    public void completeAllByChecklistItemId(Long checklistItemId) {
        List<Appointment> remaining = appointmentRepository.findAllRemainingByChecklistItemId(checklistItemId);
        List<Appointment> completed = remaining.stream()
                .map(Appointment::complete)
                .toList();

        appointmentRepository.saveAll(completed);
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

package com.bibbidi.wedding.checklist.service;

import com.bibbidi.wedding.appointment.service.AppointmentDeleteService;
import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChecklistItemDeletionService {

    private final ChecklistRepository checklistRepository;
    private final AppointmentDeleteService appointmentDeleteService;

    public ChecklistItemDeletionService(ChecklistRepository checklistRepository, AppointmentDeleteService appointmentDeleteService) {
        this.checklistRepository = checklistRepository;
        this.appointmentDeleteService = appointmentDeleteService;
    }

    @Transactional
    public void delete(Long ownerId, Long checklistItemId) {
        checklistRepository.findByChecklistItemId(checklistItemId)
                .map(checklist -> checklist.deletableItem(ownerId, checklistItemId))
                .ifPresent(this::deleteItemWithAppointments);
    }

    private void deleteItemWithAppointments(ChecklistItem item) {
        appointmentDeleteService.deleteAllByChecklistItemId(item.id());
        checklistRepository.deleteItem(item);
    }
}

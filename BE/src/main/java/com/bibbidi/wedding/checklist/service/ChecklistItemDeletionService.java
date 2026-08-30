package com.bibbidi.wedding.checklist.service;

import com.bibbidi.wedding.appointment.service.AppointmentDeleteService;
import com.bibbidi.wedding.checklist.repository.ChecklistItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChecklistItemDeletionService {

    private final ChecklistItemRepository checklistItemRepository;
    private final AppointmentDeleteService appointmentDeleteService;

    public ChecklistItemDeletionService(
            ChecklistItemRepository checklistItemRepository,
            AppointmentDeleteService appointmentDeleteService
    ) {
        this.checklistItemRepository = checklistItemRepository;
        this.appointmentDeleteService = appointmentDeleteService;
    }

    @Transactional
    public void delete(Long ownerId, Long checklistItemId) {
        checklistItemRepository.findById(checklistItemId)
                .ifPresent(item -> {
                    item.validateDeletableBy(ownerId);
                    appointmentDeleteService.deleteAllByChecklistItemId(checklistItemId);
                    checklistItemRepository.deleteById(checklistItemId);
                });
    }
}

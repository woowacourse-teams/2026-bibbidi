package com.bibbidi.wedding.checklist.service;

import com.bibbidi.wedding.appointment.service.AppointmentDeleteService;
import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.repository.ChecklistItemRepository;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChecklistItemDeletionService {

    private final ChecklistRepository checklistRepository;
    private final ChecklistItemRepository checklistItemRepository;
    private final AppointmentDeleteService appointmentDeleteService;

    public ChecklistItemDeletionService(
            ChecklistRepository checklistRepository,
            ChecklistItemRepository checklistItemRepository,
            AppointmentDeleteService appointmentDeleteService
    ) {
        this.checklistRepository = checklistRepository;
        this.checklistItemRepository = checklistItemRepository;
        this.appointmentDeleteService = appointmentDeleteService;
    }

    @Transactional
    public void delete(Long ownerId, Long checklistItemId) {
        checklistRepository.findByChecklistItemId(checklistItemId)
                .ifPresent(checklist -> {
                    ChecklistItem item = checklist.item(checklistItemId);
                    checklist.validateOwnedBy(ownerId);
                    item.validateDeletable();
                    appointmentDeleteService.deleteAllByChecklistItemId(checklistItemId);
                    checklistItemRepository.deleteById(checklistItemId);
                });
    }
}

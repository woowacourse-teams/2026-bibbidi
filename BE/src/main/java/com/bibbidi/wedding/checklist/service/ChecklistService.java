package com.bibbidi.wedding.checklist.service;

import com.bibbidi.wedding.appointment.domain.Appointment;
import com.bibbidi.wedding.appointment.service.ChecklistAppointmentService;
import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemSnapshot;
import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import com.bibbidi.wedding.checklist.service.dto.CatalogItemAdditionResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistCreationResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemWithAppointmentsResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChecklistService {

    private final ChecklistRepository checklistRepository;
    private final CatalogService catalogService;
    private final ChecklistAppointmentService checklistAppointmentService;

    public ChecklistService(ChecklistRepository checklistRepository, CatalogService catalogService,
                            ChecklistAppointmentService checklistAppointmentService) {
        this.checklistRepository = checklistRepository;
        this.catalogService = catalogService;
        this.checklistAppointmentService = checklistAppointmentService;
    }

    @Transactional
    public ChecklistCreationResult create(Long ownerId) {
        Checklist checklist = new Checklist(null, ownerId, List.of());
        Checklist saved = checklistRepository.save(checklist);

        return ChecklistCreationResult.from(saved);
    }

    @Transactional(readOnly = true)
    public ChecklistWithAppointmentsResult findMyChecklist(Long ownerId) {
        Checklist checklist = checklistRepository.getByOwnerId(ownerId);
        List<ChecklistItemWithAppointmentsResult> items = getChecklistItemWithAppointmentsResults(checklist);
        return new ChecklistWithAppointmentsResult(checklist.id(), items);
    }

    private List<ChecklistItemWithAppointmentsResult> getChecklistItemWithAppointmentsResults(
            Checklist checklist) {
        List<ChecklistItem> checklistItems = getChecklistItems(checklist);
        List<Long> checklistItemIds = checklistItems.stream()
                .map(ChecklistItem::id)
                .toList();

        Map<Long, List<Appointment>> appointmentsByChecklistItemId = checklistAppointmentService
                .findAllByChecklistItemIdInOrderByCreatedAtAscIdAsc(checklistItemIds).stream()
                .collect(Collectors.groupingBy(Appointment::checklistItemId));

        return checklistItems.stream()
                .map(item -> ChecklistItemWithAppointmentsResult.from(
                        item,
                        appointmentsByChecklistItemId.getOrDefault(item.id(), List.of())
                ))
                .toList();
    }

    private List<ChecklistItem> getChecklistItems(Checklist checklist) {
        return checklist.items().stream()
                .sorted(Comparator.comparing(ChecklistItem::title)
                        .thenComparing(ChecklistItem::id))
                .toList();
    }

    @Transactional
    public CatalogItemAdditionResult addItemsFromCatalog(Long ownerId, List<Long> catalogItemIds) {
        Checklist checklist = checklistRepository.getByOwnerId(ownerId);

        List<ChecklistItem> items = copyFromCatalog(catalogItemIds);
        List<ChecklistItem> saved = checklistRepository.saveItems(checklist, items);

        return CatalogItemAdditionResult.from(saved);
    }

    @Transactional
    public ChecklistItemResult addCustomItem(Long ownerId, String title, Long categoryId) {
        Checklist checklist = checklistRepository.getByOwnerId(ownerId);

        catalogService.validateCategoryExists(categoryId);

        ChecklistItem checklistItem = new ChecklistItem(
                null,
                categoryId,
                title,
                null,
                ChecklistItemStatus.PREV
        );
        ChecklistItem saved = checklistRepository.saveItem(checklist, checklistItem);

        return ChecklistItemResult.from(saved);
    }

    @Transactional
    public ChecklistItemResult changeItemCategory(Long ownerId, Long checklistItemId, Long categoryId) {
        Checklist checklist = checklistRepository.getByChecklistItemId(checklistItemId);
        catalogService.validateCategoryExists(categoryId);

        ChecklistItem changed = checklist.changeItemCategory(ownerId, checklistItemId, categoryId);
        ChecklistItem saved = checklistRepository.saveItem(checklist, changed);

        return ChecklistItemResult.from(saved);
    }

    @Transactional
    public ChecklistItemResult changeItemTitle(Long ownerId, Long checklistItemId, String title) {
        Checklist checklist = checklistRepository.getByChecklistItemId(checklistItemId);

        ChecklistItem changed = checklist.changeItemTitle(ownerId, checklistItemId, title);
        ChecklistItem saved = checklistRepository.saveItem(checklist, changed);

        return ChecklistItemResult.from(saved);
    }

    @Transactional(readOnly = true)
    public void validateItemOwnership(Long checklistItemId, Long ownerId) {
        Checklist checklist = checklistRepository.getByChecklistItemId(checklistItemId);
        checklist.validateOwnedBy(ownerId);
    }

    @Transactional
    public boolean changeItemStatusByAppointment(Long ownerId, Long checklistItemId, boolean appointmentDone) {
        Checklist checklist = checklistRepository.getByChecklistItemId(checklistItemId);
        if (appointmentDone) {
            return checklist.isItemDone(ownerId, checklistItemId);
        }

        reopenItemIfDone(ownerId, checklistItemId, checklist);
        return false;
    }

    private void reopenItemIfDone(Long ownerId, Long checklistItemId, Checklist checklist) {
        if (!checklist.isItemDone(ownerId, checklistItemId)) {
            return;
        }

        ChecklistItem changed = checklist.changeItemStatus(ownerId, checklistItemId, ChecklistItemStatus.CONTINUE);
        checklistRepository.saveItem(checklist, changed);
    }

    @Transactional
    public ChecklistItemResult changeItemStatus(Long ownerId, Long checklistItemId, String status) {
        ChecklistItemStatus newStatus = ChecklistItemStatus.from(status);

        Checklist checklist = checklistRepository.getByChecklistItemId(checklistItemId);
        ChecklistItem changed = checklist.changeItemStatus(ownerId, checklistItemId, newStatus);
        changeAppointmentsStatus(changed);
        ChecklistItem saved = checklistRepository.saveItem(checklist, changed);

        return ChecklistItemResult.from(saved);
    }

    private void changeAppointmentsStatus(ChecklistItem item) {
        if (item.isDone()) {
            checklistAppointmentService.completeAllByChecklistItemId(item.id());
        } else {
            checklistAppointmentService.reopenAllDoneByChecklistItemId(item.id());
        }
    }

    @Transactional(readOnly = true)
    public boolean hasRemainingAppointments(Long ownerId, Long checklistItemId) {
        validateItemOwnership(checklistItemId, ownerId);

        return checklistAppointmentService.hasRemainingAppointment(checklistItemId);
    }

    @Transactional
    public void deleteItem(Long ownerId, Long checklistItemId) {
        checklistRepository.findByChecklistItemId(checklistItemId)
                .map(checklist -> checklist.deletableItem(ownerId, checklistItemId))
                .ifPresent(this::deleteItemWithAppointments);
    }

    private void deleteItemWithAppointments(ChecklistItem item) {
        checklistAppointmentService.deleteAllByChecklistItemId(item.id());
        checklistRepository.deleteItem(item);
    }

    @Transactional
    public void deleteByOwnerId(Long ownerId) {
        checklistRepository.findByOwnerId(ownerId)
                .ifPresent(this::deleteChecklistData);
    }

    private void deleteChecklistData(Checklist checklist) {
        List<Long> checklistItemIds = checklist.itemIds();

        checklistAppointmentService.deleteAllByChecklistItemIds(checklistItemIds);
        checklistRepository.delete(checklist);
    }

    private List<ChecklistItem> copyFromCatalog(List<Long> catalogItemIds) {
        Set<Long> requestedIds = new LinkedHashSet<>(catalogItemIds);
        List<CatalogItemSnapshot> catalogItems = catalogService.findItems(requestedIds);

        if (catalogItems.size() != requestedIds.size()) {
            Set<Long> missingIds = new LinkedHashSet<>(requestedIds);
            catalogItems.forEach(catalogItem -> missingIds.remove(catalogItem.id()));

            throw new BusinessException(
                    ClientError.INVALID_REQUEST,
                    "준비 목록에 없는 항목이 포함되었습니다. catalogItemIds=" + missingIds
            );
        }

        return catalogItems.stream()
                .map(catalogItem -> new ChecklistItem(
                        null,
                        catalogItem.categoryId(),
                        catalogItem.title(),
                        catalogItem.id(),
                        ChecklistItemStatus.PREV
                ))
                .toList();
    }
}

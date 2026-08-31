package com.bibbidi.wedding.checklist.service;

import com.bibbidi.wedding.appointment.service.ChecklistAppointmentDeleteService;
import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemSnapshot;
import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.repository.ChecklistItemRepository;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import com.bibbidi.wedding.checklist.service.dto.CatalogItemAdditionResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistCreationResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChecklistService {

    private final ChecklistRepository checklistRepository;
    private final ChecklistItemRepository checklistItemRepository;
    private final CatalogService catalogService;
    private final ChecklistAppointmentDeleteService checklistAppointmentDeleteService;

    public ChecklistService(
            ChecklistRepository checklistRepository,
            ChecklistItemRepository checklistItemRepository,
            CatalogService catalogService,
            ChecklistAppointmentDeleteService checklistAppointmentDeleteService
    ) {
        this.checklistRepository = checklistRepository;
        this.checklistItemRepository = checklistItemRepository;
        this.catalogService = catalogService;
        this.checklistAppointmentDeleteService = checklistAppointmentDeleteService;
    }

    @Transactional
    public ChecklistCreationResult create(Long ownerId) {
        Checklist checklist = checklistRepository.save(new Checklist(null, ownerId, List.of()));

        return ChecklistCreationResult.from(checklist);
    }

    @Transactional
    public CatalogItemAdditionResult addCatalogItems(Long ownerId, List<Long> catalogItemIds) {
        Checklist checklist = checklistRepository.getByOwnerId(ownerId);

        List<ChecklistItem> candidates = selectCatalogItems(catalogItemIds);

        return CatalogItemAdditionResult.from(checklistItemRepository.saveAll(checklist.id(), candidates));
    }

    @Transactional
    public ChecklistItemResult writeItem(Long ownerId, String title, Long categoryId) {
        Checklist checklist = checklistRepository.getByOwnerId(ownerId);

        catalogService.validateCategoryExists(categoryId);

        ChecklistItem item = checklistItemRepository.save(checklist.id(), new ChecklistItem(
                null,
                categoryId,
                title,
                null,
                ChecklistItemStatus.PREV
        ));

        return ChecklistItemResult.from(item);
    }

    @Transactional
    public ChecklistItemResult changeItemCategory(
            Long ownerId,
            Long checklistItemId,
            Long categoryId
    ) {
        Checklist checklist = checklistRepository.getByChecklistItemId(checklistItemId);

        catalogService.validateCategoryExists(categoryId);

        checklist.validateOwnedBy(ownerId);
        ChecklistItem item = checklist.item(checklistItemId);

        ChecklistItem changed = checklistItemRepository.save(
                checklist.id(),
                item.changeCategory(categoryId)
        );

        return ChecklistItemResult.from(changed);
    }

    @Transactional
    public ChecklistItemResult changeItemTitle(
            Long ownerId,
            Long checklistItemId,
            String title
    ) {
        Checklist checklist = checklistRepository.getByChecklistItemId(checklistItemId);

        checklist.validateOwnedBy(ownerId);
        ChecklistItem item = checklist.item(checklistItemId);

        ChecklistItem changed = checklistItemRepository.save(
                checklist.id(),
                item.changeTitle(title)
        );

        return ChecklistItemResult.from(changed);
    }

    @Transactional(readOnly = true)
    public void validateItemOwnership(Long checklistItemId, Long ownerId) {
        Checklist checklist = checklistRepository.getByChecklistItemId(checklistItemId);
        checklist.validateOwnedBy(ownerId);
    }

    @Transactional
    public void deleteByOwnerId(Long ownerId) {
        checklistRepository.findByOwnerId(ownerId)
                .ifPresent(this::deleteChecklistData);
    }

    private void deleteChecklistData(Checklist checklist) {
        List<Long> checklistItemIds = checklist.items().stream()
                .map(ChecklistItem::id)
                .toList();
        checklistAppointmentDeleteService.deleteAllByChecklistItemIds(checklistItemIds);
        checklistItemRepository.deleteAllByChecklistId(checklist.id());
        checklistRepository.deleteById(checklist.id());
    }

    private List<ChecklistItem> selectCatalogItems(List<Long> catalogItemIds) {
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

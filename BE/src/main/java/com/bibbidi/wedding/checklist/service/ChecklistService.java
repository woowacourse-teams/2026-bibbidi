package com.bibbidi.wedding.checklist.service;

import com.bibbidi.wedding.appointment.service.AppointmentDeleteService;
import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemSnapshot;
import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.repository.ChecklistItemRepository;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import com.bibbidi.wedding.checklist.service.dto.CatalogItemAdditionResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistCreationResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemCategoryChangeResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemCreationResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChecklistService {

    private static final String DUPLICATE_CHECKLIST_MESSAGE = "체크리스트 중복 생성에 실패했습니다. ownerId=";
    private static final String CHECKLIST_NOT_FOUND_MESSAGE = "현재 사용자 계정에 속한 체크리스트를 찾을 수 없습니다. ownerId=";

    private final ChecklistRepository checklistRepository;
    private final ChecklistItemRepository checklistItemRepository;
    private final CatalogService catalogService;
    private final AppointmentDeleteService appointmentDeleteService;

    public ChecklistService(
            ChecklistRepository checklistRepository,
            ChecklistItemRepository checklistItemRepository,
            CatalogService catalogService,
            AppointmentDeleteService appointmentDeleteService
    ) {
        this.checklistRepository = checklistRepository;
        this.checklistItemRepository = checklistItemRepository;
        this.catalogService = catalogService;
        this.appointmentDeleteService = appointmentDeleteService;
    }

    @Transactional
    public ChecklistCreationResult create(Long ownerId) {
        if (checklistRepository.existsByOwnerId(ownerId)) {
            throw new BusinessException(
                    ClientError.DUPLICATE_CHECKLIST,
                    DUPLICATE_CHECKLIST_MESSAGE + ownerId
            );
        }

        try {
            Checklist checklist = checklistRepository.save(new Checklist(null, ownerId));
            return ChecklistCreationResult.from(checklist);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(
                    ClientError.DUPLICATE_CHECKLIST,
                    DUPLICATE_CHECKLIST_MESSAGE + ownerId
            );
        }
    }

    @Transactional
    public CatalogItemAdditionResult addCatalogItems(Long ownerId, List<Long> catalogItemIds) {
        Checklist checklist = checklistRepository.findByOwnerId(ownerId)
                .orElseThrow(() -> new BusinessException(
                        ClientError.CHECKLIST_NOT_FOUND,
                        CHECKLIST_NOT_FOUND_MESSAGE + ownerId
                ));

        List<ChecklistItem> candidates = selectCatalogItems(checklist, catalogItemIds);

        try {
            return CatalogItemAdditionResult.from(checklistItemRepository.saveAll(candidates));
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(
                    ClientError.DUPLICATE_CHECKLIST_ITEM,
                    "이미 추가된 준비 항목이 포함되었습니다. checklistId=" + checklist.id()
                            + ", catalogItemIds=" + catalogItemIds
            );
        }
    }

    @Transactional
    public ChecklistItemCreationResult writeItem(Long ownerId, String title, Long categoryId) {
        Checklist checklist = checklistRepository.findByOwnerId(ownerId)
                .orElseThrow(() -> new BusinessException(
                        ClientError.CHECKLIST_NOT_FOUND,
                        CHECKLIST_NOT_FOUND_MESSAGE + ownerId
                ));

        if (!catalogService.existsCategory(categoryId)) {
            throw new BusinessException(
                    ClientError.CATEGORY_NOT_FOUND,
                    "준비 목록에 없는 카테고리입니다. categoryId=" + categoryId
            );
        }

        ChecklistItem item = checklistItemRepository.save(new ChecklistItem(
                null,
                checklist,
                categoryId,
                title,
                null,
                ChecklistItemStatus.PREV
        ));

        return ChecklistItemCreationResult.from(item);
    }

    @Transactional
    public ChecklistItemCategoryChangeResult changeItemCategory(
            Long ownerId,
            Long checklistItemId,
            Long categoryId
    ) {
        ChecklistItem item = checklistItemRepository.findById(checklistItemId)
                .orElseThrow(() -> new BusinessException(
                        ClientError.CHECKLIST_ITEM_NOT_FOUND,
                        "할 일을 찾을 수 없습니다. checklistItemId=" + checklistItemId
                ));

        if (!item.isOwnedBy(ownerId)) {
            throw new BusinessException(
                    ClientError.CHECKLIST_ITEM_ACCESS_DENIED,
                    "현재 사용자 계정에 속한 할 일이 아닙니다. ownerId=" + ownerId
                            + ", checklistItemId=" + checklistItemId
            );
        }

        if (!catalogService.existsCategory(categoryId)) {
            throw new BusinessException(
                    ClientError.CATEGORY_NOT_FOUND,
                    "준비 목록에 없는 카테고리입니다. categoryId=" + categoryId
            );
        }

        ChecklistItem changed = checklistItemRepository.save(item.changeCategory(categoryId));

        return ChecklistItemCategoryChangeResult.from(changed);
    }

    @Transactional(readOnly = true)
    public boolean checkItemOwnership(Long checklistItemId, Long ownerId) {
        return checklistItemRepository.findById(checklistItemId)
                .map(item -> item.isOwnedBy(ownerId))
                .orElse(false);
    }

    @Transactional
    public void deleteByOwnerId(Long ownerId) {
        checklistRepository.findByOwnerId(ownerId)
                .ifPresent(this::deleteChecklistData);
    }

    private void deleteChecklistData(Checklist checklist) {
        List<Long> checklistItemIds = checklistItemRepository.findIdsByChecklistId(checklist.id());
        appointmentDeleteService.deleteAllByChecklistItemIds(checklistItemIds);
        checklistItemRepository.deleteAllByChecklistId(checklist.id());
        checklistRepository.deleteById(checklist.id());
    }

    private List<ChecklistItem> selectCatalogItems(Checklist checklist, List<Long> catalogItemIds) {
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
                        checklist,
                        catalogItem.categoryId(),
                        catalogItem.title(),
                        catalogItem.id(),
                        ChecklistItemStatus.PREV
                ))
                .toList();
    }
}

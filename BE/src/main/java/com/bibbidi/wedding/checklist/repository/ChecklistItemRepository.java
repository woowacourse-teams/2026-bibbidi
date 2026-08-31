package com.bibbidi.wedding.checklist.repository;

import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;

@Repository
public class ChecklistItemRepository {

    private static final String CHECKLIST_ITEM_NOT_FOUND_MESSAGE = "할 일을 찾을 수 없습니다. checklistItemId=";
    private static final String DUPLICATE_CHECKLIST_ITEM_MESSAGE = "이미 추가된 준비 항목이 포함되었습니다. checklistId=";

    private final JpaChecklistItemRepository jpaChecklistItemRepository;
    private final ChecklistMapper checklistMapper;
    private final EntityManager entityManager;

    public ChecklistItemRepository(
            JpaChecklistItemRepository jpaChecklistItemRepository,
            ChecklistMapper checklistMapper,
            EntityManager entityManager
    ) {
        this.jpaChecklistItemRepository = jpaChecklistItemRepository;
        this.checklistMapper = checklistMapper;
        this.entityManager = entityManager;
    }

    public ChecklistItem getById(Long checklistItemId) {
        return findById(checklistItemId)
                .orElseThrow(() -> new BusinessException(
                        ClientError.CHECKLIST_ITEM_NOT_FOUND,
                        CHECKLIST_ITEM_NOT_FOUND_MESSAGE + checklistItemId
                ));
    }

    public Optional<ChecklistItem> findById(Long checklistItemId) {
        return jpaChecklistItemRepository.findById(checklistItemId)
                .map(checklistMapper::toDomain);
    }

    public List<ChecklistItem> findByChecklistId(Long checklistId) {
        return jpaChecklistItemRepository.findByChecklistId(checklistId).stream()
                .map(checklistMapper::toDomain)
                .toList();
    }

    public List<Long> findIdsByChecklistId(Long checklistId) {
        return jpaChecklistItemRepository.findIdsByChecklistId(checklistId);
    }

    public int deleteAllByChecklistId(Long checklistId) {
        return jpaChecklistItemRepository.deleteAllByChecklistId(checklistId);
    }

    public ChecklistItem save(Long checklistId, ChecklistItem checklistItem) {
        JpaChecklistItemEntity entity = checklistMapper.toEntity(checklistItem, referenceOf(checklistId));

        try {
            return checklistMapper.toDomain(jpaChecklistItemRepository.saveAndFlush(entity));
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(
                    ClientError.DUPLICATE_CHECKLIST_ITEM,
                    DUPLICATE_CHECKLIST_ITEM_MESSAGE + checklistId
                            + ", catalogItemId=" + checklistItem.sourceCatalogItemId()
            );
        }
    }

    public List<ChecklistItem> saveAll(Long checklistId, List<ChecklistItem> checklistItems) {
        List<JpaChecklistItemEntity> entities = checklistItems.stream()
                .map(item -> checklistMapper.toEntity(item, referenceOf(checklistId)))
                .toList();

        try {
            return jpaChecklistItemRepository.saveAllAndFlush(entities).stream()
                    .map(checklistMapper::toDomain)
                    .toList();
        } catch (DataIntegrityViolationException exception) {
            List<Long> catalogItemIds = checklistItems.stream()
                    .map(ChecklistItem::sourceCatalogItemId)
                    .toList();

            throw new BusinessException(
                    ClientError.DUPLICATE_CHECKLIST_ITEM,
                    DUPLICATE_CHECKLIST_ITEM_MESSAGE + checklistId + ", catalogItemIds=" + catalogItemIds
            );
        }
    }

    public void deleteById(Long checklistItemId) {
        jpaChecklistItemRepository.deleteById(checklistItemId);
    }

    private JpaChecklistEntity referenceOf(Long checklistId) {
        return entityManager.getReference(JpaChecklistEntity.class, checklistId);
    }
}

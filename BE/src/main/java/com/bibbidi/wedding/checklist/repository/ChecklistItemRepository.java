package com.bibbidi.wedding.checklist.repository;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public class ChecklistItemRepository {

    private static final String CHECKLIST_ITEM_NOT_FOUND_MESSAGE = "할 일을 찾을 수 없습니다. checklistItemId=";

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
        return jpaChecklistItemRepository.findByIdWithChecklist(checklistItemId)
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

    public ChecklistItem save(ChecklistItem checklistItem) {
        JpaChecklistItemEntity entity = checklistMapper.toEntity(checklistItem, referenceOf(checklistItem));
        JpaChecklistItemEntity saved = jpaChecklistItemRepository.saveAndFlush(entity);

        return checklistMapper.toDomain(saved);
    }

    public List<ChecklistItem> saveAll(List<ChecklistItem> checklistItems) {
        List<JpaChecklistItemEntity> entities = checklistItems.stream()
                .map(item -> checklistMapper.toEntity(item, referenceOf(item)))
                .toList();

        return jpaChecklistItemRepository.saveAllAndFlush(entities).stream()
                .map(checklistMapper::toDomain)
                .toList();
    }

    public void deleteById(Long checklistItemId) {
        jpaChecklistItemRepository.deleteById(checklistItemId);
    }

    private JpaChecklistEntity referenceOf(ChecklistItem checklistItem) {
        Checklist checklist = checklistItem.checklist();

        return entityManager.getReference(JpaChecklistEntity.class, checklist.id());
    }
}

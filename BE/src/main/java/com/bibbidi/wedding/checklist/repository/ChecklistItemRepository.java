package com.bibbidi.wedding.checklist.repository;

import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public class ChecklistItemRepository {

    private final JpaChecklistItemRepository jpaChecklistItemRepository;
    private final ChecklistMapper checklistMapper;

    public ChecklistItemRepository(
            JpaChecklistItemRepository jpaChecklistItemRepository,
            ChecklistMapper checklistMapper
    ) {
        this.jpaChecklistItemRepository = jpaChecklistItemRepository;
        this.checklistMapper = checklistMapper;
    }

    public Optional<ChecklistItem> findById(Long checklistItemId) {
        return jpaChecklistItemRepository.findById(checklistItemId)
                .map(checklistMapper::toDomain);
    }

    public boolean existsByIdAndOwnerId(Long checklistItemId, Long ownerId) {
        return jpaChecklistItemRepository.existsByIdAndOwnerId(checklistItemId, ownerId);
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
        JpaChecklistItemEntity entity = checklistMapper.toEntity(checklistItem);
        JpaChecklistItemEntity saved = jpaChecklistItemRepository.saveAndFlush(entity);

        return checklistMapper.toDomain(saved);
    }

    public List<ChecklistItem> saveAll(List<ChecklistItem> checklistItems) {
        List<JpaChecklistItemEntity> entities = checklistItems.stream()
                .map(checklistMapper::toEntity)
                .toList();

        return jpaChecklistItemRepository.saveAllAndFlush(entities).stream()
                .map(checklistMapper::toDomain)
                .toList();
    }
}

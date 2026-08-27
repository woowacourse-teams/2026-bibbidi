package com.bibbidi.wedding.checklist.repository;

import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
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

    public ChecklistItem findById(Long checklistItemId) {
        JpaChecklistItemEntity entity = getChecklistItemEntity(checklistItemId);

        return checklistMapper.toDomain(entity);
    }

    public List<ChecklistItem> findByChecklistId(Long checklistId) {
        return jpaChecklistItemRepository.findByChecklistId(checklistId).stream()
                .map(checklistMapper::toDomain)
                .toList();
    }

    public ChecklistItem save(ChecklistItem checklistItem) {
        JpaChecklistItemEntity entity = checklistMapper.toEntity(checklistItem);
        JpaChecklistItemEntity saved = jpaChecklistItemRepository.saveAndFlush(entity);

        return checklistMapper.toDomain(saved);
    }

    private JpaChecklistItemEntity getChecklistItemEntity(Long checklistItemId) {
        return jpaChecklistItemRepository.findById(checklistItemId).orElseThrow(
                () -> new BusinessException(
                        ClientError.CHECKLIST_ITEM_NOT_FOUND,
                        "할 일 조회에 실패했습니다 : " + checklistItemId
                )
        );
    }
}

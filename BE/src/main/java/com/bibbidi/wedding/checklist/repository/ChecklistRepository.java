package com.bibbidi.wedding.checklist.repository;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;

@Repository
public class ChecklistRepository {

    private static final String CHECKLIST_NOT_FOUND_MESSAGE = "현재 사용자 계정에 속한 체크리스트를 찾을 수 없습니다. ownerId=";
    private static final String DUPLICATE_CHECKLIST_MESSAGE = "체크리스트 중복 생성에 실패했습니다. ownerId=";
    private static final String DUPLICATE_CHECKLIST_ITEM_MESSAGE = "이미 추가된 준비 항목이 포함되었습니다. checklistId=";

    private final JpaChecklistRepository jpaChecklistRepository;
    private final JpaChecklistItemRepository jpaChecklistItemRepository;
    private final ChecklistMapper checklistMapper;
    private final EntityManager entityManager;

    public ChecklistRepository(
            JpaChecklistRepository jpaChecklistRepository,
            JpaChecklistItemRepository jpaChecklistItemRepository,
            ChecklistMapper checklistMapper,
            EntityManager entityManager
    ) {
        this.jpaChecklistRepository = jpaChecklistRepository;
        this.jpaChecklistItemRepository = jpaChecklistItemRepository;
        this.checklistMapper = checklistMapper;
        this.entityManager = entityManager;
    }

    public Checklist save(Checklist checklist) {
        validateNotDuplicated(checklist.ownerId());
        JpaChecklistEntity entity = checklistMapper.toEntity(checklist);

        try {
            JpaChecklistEntity savedChecklist = jpaChecklistRepository.saveAndFlush(entity);

            return checklistMapper.toDomain(savedChecklist, List.of());
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(
                    ClientError.DUPLICATE_CHECKLIST,
                    DUPLICATE_CHECKLIST_MESSAGE + checklist.ownerId()
            );
        }
    }

    public Checklist getByOwnerId(Long ownerId) {
        return findByOwnerId(ownerId)
                .orElseThrow(() -> new BusinessException(
                        ClientError.CHECKLIST_NOT_FOUND,
                        CHECKLIST_NOT_FOUND_MESSAGE + ownerId
                ));
    }

    public Optional<Checklist> findByOwnerId(Long ownerId) {
        return jpaChecklistRepository.findByOwnerId(ownerId)
                .map(this::toDomain);
    }

    public Checklist getByChecklistItemId(Long checklistItemId) {
        return findByChecklistItemId(checklistItemId)
                .orElseThrow(() -> new BusinessException(
                        ClientError.CHECKLIST_ITEM_NOT_FOUND,
                        "할 일을 찾을 수 없습니다. checklistItemId=" + checklistItemId
                ));
    }

    public Optional<Checklist> findByChecklistItemId(Long checklistItemId) {
        return jpaChecklistRepository.findByChecklistItemId(checklistItemId)
                .map(this::toDomain);
    }

    public ChecklistItem saveItem(Checklist checklist, ChecklistItem checklistItem) {
        JpaChecklistEntity checklistReference = referenceOf(checklist.id());
        JpaChecklistItemEntity entity = checklistMapper.toEntity(checklistItem, checklistReference);

        try {
            JpaChecklistItemEntity savedChecklistItem = jpaChecklistItemRepository.saveAndFlush(entity);

            return checklistMapper.toDomain(savedChecklistItem);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(
                    ClientError.DUPLICATE_CHECKLIST_ITEM,
                    DUPLICATE_CHECKLIST_ITEM_MESSAGE + checklist.id()
                            + ", catalogItemId=" + checklistItem.sourceCatalogItemId()
            );
        }
    }

    public List<ChecklistItem> saveItems(Checklist checklist, List<ChecklistItem> checklistItems) {
        JpaChecklistEntity checklistReference = referenceOf(checklist.id());
        List<JpaChecklistItemEntity> entities = checklistItems.stream()
                .map(item -> checklistMapper.toEntity(item, checklistReference))
                .toList();

        try {
            List<JpaChecklistItemEntity> savedChecklistItems = jpaChecklistItemRepository.saveAllAndFlush(entities);

            return savedChecklistItems.stream()
                    .map(checklistMapper::toDomain)
                    .toList();
        } catch (DataIntegrityViolationException exception) {
            List<Long> catalogItemIds = checklistItems.stream()
                    .map(ChecklistItem::sourceCatalogItemId)
                    .toList();

            throw new BusinessException(
                    ClientError.DUPLICATE_CHECKLIST_ITEM,
                    DUPLICATE_CHECKLIST_ITEM_MESSAGE + checklist.id() + ", catalogItemIds=" + catalogItemIds
            );
        }
    }

    public void deleteItem(ChecklistItem checklistItem) {
        jpaChecklistItemRepository.deleteById(checklistItem.id());
    }

    public void delete(Checklist checklist) {
        jpaChecklistItemRepository.deleteAllByChecklistId(checklist.id());
        jpaChecklistRepository.deleteByChecklistId(checklist.id());
    }

    private void validateNotDuplicated(Long ownerId) {
        if (jpaChecklistRepository.existsByOwnerId(ownerId)) {
            throw new BusinessException(
                    ClientError.DUPLICATE_CHECKLIST,
                    DUPLICATE_CHECKLIST_MESSAGE + ownerId
            );
        }
    }

    private Checklist toDomain(JpaChecklistEntity checklist) {
        List<JpaChecklistItemEntity> items = jpaChecklistItemRepository.findByChecklistId(checklist.id());

        return checklistMapper.toDomain(checklist, items);
    }

    private JpaChecklistEntity referenceOf(Long checklistId) {
        return entityManager.getReference(JpaChecklistEntity.class, checklistId);
    }
}

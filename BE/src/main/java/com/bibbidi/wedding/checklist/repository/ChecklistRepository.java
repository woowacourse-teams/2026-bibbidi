package com.bibbidi.wedding.checklist.repository;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;

@Repository
public class ChecklistRepository {

    private static final String CHECKLIST_NOT_FOUND_MESSAGE = "현재 사용자 계정에 속한 체크리스트를 찾을 수 없습니다. ownerId=";
    private static final String DUPLICATE_CHECKLIST_MESSAGE = "체크리스트 중복 생성에 실패했습니다. ownerId=";

    private final JpaChecklistRepository jpaChecklistRepository;
    private final JpaChecklistItemRepository jpaChecklistItemRepository;
    private final ChecklistMapper checklistMapper;

    public ChecklistRepository(
            JpaChecklistRepository jpaChecklistRepository,
            JpaChecklistItemRepository jpaChecklistItemRepository,
            ChecklistMapper checklistMapper
    ) {
        this.jpaChecklistRepository = jpaChecklistRepository;
        this.jpaChecklistItemRepository = jpaChecklistItemRepository;
        this.checklistMapper = checklistMapper;
    }

    public Checklist save(Checklist checklist) {
        validateNotDuplicated(checklist.ownerId());
        JpaChecklistEntity entity = checklistMapper.toEntity(checklist);

        try {
            JpaChecklistEntity saved = jpaChecklistRepository.saveAndFlush(entity);

            return checklistMapper.toDomain(saved, List.of());
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

    public int deleteById(Long checklistId) {
        return jpaChecklistRepository.deleteByChecklistId(checklistId);
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
        return checklistMapper.toDomain(
                checklist,
                jpaChecklistItemRepository.findByChecklistId(checklist.id())
        );
    }
}

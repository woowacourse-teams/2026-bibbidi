package com.bibbidi.wedding.checklist.repository;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public class ChecklistRepository {

    private static final String CHECKLIST_NOT_FOUND_MESSAGE = "현재 사용자 계정에 속한 체크리스트를 찾을 수 없습니다. ownerId=";

    private final JpaChecklistRepository jpaChecklistRepository;
    private final ChecklistMapper checklistMapper;

    public ChecklistRepository(
            JpaChecklistRepository jpaChecklistRepository,
            ChecklistMapper checklistMapper
    ) {
        this.jpaChecklistRepository = jpaChecklistRepository;
        this.checklistMapper = checklistMapper;
    }

    public boolean existsByOwnerId(Long ownerId) {
        return jpaChecklistRepository.existsByOwnerId(ownerId);
    }

    public Checklist save(Checklist checklist) {
        JpaChecklistEntity entity = checklistMapper.toEntity(checklist);
        JpaChecklistEntity saved = jpaChecklistRepository.saveAndFlush(entity);

        return checklistMapper.toDomain(saved);
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
                .map(checklistMapper::toDomain);
    }

    public int deleteById(Long checklistId) {
        return jpaChecklistRepository.deleteByChecklistId(checklistId);
    }
}

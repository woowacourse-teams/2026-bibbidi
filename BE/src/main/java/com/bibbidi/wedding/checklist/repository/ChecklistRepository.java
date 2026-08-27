package com.bibbidi.wedding.checklist.repository;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import org.springframework.stereotype.Repository;

@Repository
public class ChecklistRepository {

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

    public Checklist findByOwnerId(Long ownerId) {
        JpaChecklistEntity checklistEntity = getChecklistEntity(ownerId);

        return checklistMapper.toDomain(checklistEntity);
    }

    private JpaChecklistEntity getChecklistEntity(Long ownerId) {
        return jpaChecklistRepository.findByOwnerId(ownerId).orElseThrow(
                () -> new BusinessException(
                        ClientError.CHECKLIST_NOT_FOUND,
                        "현재 사용자 계정에 속한 체크리스트를 찾을 수 없습니다 : " + ownerId
                )
        );
    }
}

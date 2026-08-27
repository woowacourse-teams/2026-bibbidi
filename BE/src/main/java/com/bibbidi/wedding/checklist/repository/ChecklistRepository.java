package com.bibbidi.wedding.checklist.repository;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import java.util.Optional;
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

    public Optional<Checklist> findByOwnerId(Long ownerId) {
        return jpaChecklistRepository.findByOwnerId(ownerId)
                .map(checklistMapper::toDomain);
    }
}

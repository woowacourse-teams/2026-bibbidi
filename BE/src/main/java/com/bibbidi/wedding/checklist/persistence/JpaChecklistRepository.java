package com.bibbidi.wedding.checklist.persistence;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Repository;

@Repository
public class JpaChecklistRepository implements ChecklistRepository {

    private final ChecklistDao checklistDao;
    private final ChecklistMapper checklistMapper;

    public JpaChecklistRepository(ChecklistDao checklistDao, ChecklistMapper checklistMapper) {
        this.checklistDao = checklistDao;
        this.checklistMapper = checklistMapper;
    }

    @Override
    public Checklist save(Checklist checklist) {
        ChecklistEntity saved = checklistDao.saveAndFlush(checklistMapper.toEntity(checklist));
        return checklistMapper.toDomain(saved);
    }

    @Override
    public Optional<Checklist> findByOwnerId(UUID ownerId) {
        return checklistDao.findByOwnerId(ownerId).map(checklistMapper::toDomain);
    }
}

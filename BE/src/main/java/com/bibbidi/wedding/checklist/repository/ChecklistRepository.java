package com.bibbidi.wedding.checklist.repository;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import org.springframework.stereotype.Repository;

@Repository
public class ChecklistRepository {

    private final JpaChecklistRepository jpaChecklistRepository;

    public ChecklistRepository(JpaChecklistRepository jpaChecklistRepository) {
        this.jpaChecklistRepository = jpaChecklistRepository;
    }

    public boolean existsByOwnerId(Long ownerId) {
        return jpaChecklistRepository.existsByOwnerId(ownerId);
    }

    public Checklist save(Checklist checklist) {
        JpaChecklistEntity entity = new JpaChecklistEntity(checklist.id(), checklist.ownerId());
        JpaChecklistEntity saved = jpaChecklistRepository.saveAndFlush(entity);

        return new Checklist(saved.id(), saved.ownerId());
    }
}

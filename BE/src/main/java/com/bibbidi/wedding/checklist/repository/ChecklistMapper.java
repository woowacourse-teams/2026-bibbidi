package com.bibbidi.wedding.checklist.repository;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import org.springframework.stereotype.Component;

@Component
public class ChecklistMapper {

    public JpaChecklistEntity toEntity(Checklist checklist) {
        return new JpaChecklistEntity(
                checklist.id(),
                checklist.ownerId()
        );
    }

    public Checklist toDomain(JpaChecklistEntity entity) {
        return new Checklist(
                entity.id(),
                entity.ownerId()
        );
    }
}

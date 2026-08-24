package com.bibbidi.wedding.checklist.persistence;

import com.bibbidi.wedding.checklist.domain.Checklist;
import org.springframework.stereotype.Component;

@Component
public class ChecklistMapper {

    public ChecklistEntity toEntity(Checklist checklist) {
        return new ChecklistEntity(checklist.id(), checklist.ownerId());
    }

    public Checklist toDomain(ChecklistEntity entity) {
        return Checklist.restore(entity.id(), entity.ownerId());
    }
}

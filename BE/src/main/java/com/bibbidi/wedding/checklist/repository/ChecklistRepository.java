package com.bibbidi.wedding.checklist.repository;

import com.bibbidi.wedding.checklist.domain.Checklist;
import java.util.Optional;

public interface ChecklistRepository {

    Checklist save(Checklist checklist);

    Optional<Checklist> findByOwnerId(Long ownerId);
}

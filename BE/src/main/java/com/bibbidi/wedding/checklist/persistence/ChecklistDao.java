package com.bibbidi.wedding.checklist.persistence;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChecklistDao extends JpaRepository<ChecklistEntity, Long> {

    Optional<ChecklistEntity> findByOwnerId(Long ownerId);
}

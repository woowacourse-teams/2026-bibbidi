package com.bibbidi.wedding.checklist.persistence;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JpaChecklistRepository extends JpaRepository<JpaChecklistEntity, Long> {

    boolean existsByOwnerId(Long ownerId);

    Optional<JpaChecklistEntity> findByOwnerId(Long ownerId);
}

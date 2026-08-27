package com.bibbidi.wedding.checklist.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface JpaChecklistRepository extends JpaRepository<JpaChecklistEntity, Long> {

    boolean existsByOwnerId(Long ownerId);
}

package com.bibbidi.wedding.checklist.persistence;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JpaChecklistRepository extends JpaRepository<JpaChecklistEntity, Long> {

    boolean existsByOwnerId(Long ownerId);

    Optional<JpaChecklistEntity> findByOwnerId(Long ownerId);

    @Query("""
            SELECT new com.bibbidi.wedding.checklist.persistence.ChecklistWithItem(checklist, item)
            FROM JpaChecklistEntity checklist
            LEFT JOIN JpaChecklistItemEntity item ON item.checklist = checklist
            WHERE checklist.ownerId = :ownerId
            """)
    List<ChecklistWithItem> findAllWithItemsByOwnerId(@Param("ownerId") Long ownerId);

    @Query("""
            SELECT item.checklist
            FROM JpaChecklistItemEntity item
            WHERE item.id = :checklistItemId
            """)
    Optional<JpaChecklistEntity> findByChecklistItemId(@Param("checklistItemId") Long checklistItemId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM JpaChecklistEntity checklist WHERE checklist.id = :checklistId")
    int deleteByChecklistId(@Param("checklistId") Long checklistId);
}

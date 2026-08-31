package com.bibbidi.wedding.checklist.persistence;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JpaChecklistItemRepository extends JpaRepository<JpaChecklistItemEntity, Long> {

    @Query("""
            SELECT item.sourceCatalogItemId
            FROM JpaChecklistItemEntity item
            WHERE item.checklist.ownerId = :userId
              AND item.sourceCatalogItemId IS NOT NULL
            """)
    List<Long> findIncludedCatalogItemIds(@Param("userId") Long userId);

    @Query("""
            SELECT item
            FROM JpaChecklistItemEntity item
            WHERE item.checklist.id = :checklistId
            """)
    List<JpaChecklistItemEntity> findByChecklistId(@Param("checklistId") Long checklistId);

    @Query("SELECT item.id FROM JpaChecklistItemEntity item WHERE item.checklist.id = :checklistId")
    List<Long> findIdsByChecklistId(@Param("checklistId") Long checklistId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM JpaChecklistItemEntity item WHERE item.checklist.id = :checklistId")
    int deleteAllByChecklistId(@Param("checklistId") Long checklistId);
}

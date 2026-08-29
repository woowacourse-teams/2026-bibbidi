package com.bibbidi.wedding.checklist.persistence;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JpaChecklistItemRepository extends JpaRepository<JpaChecklistItemEntity, Long> {

    @Query("""
            SELECT item
            FROM JpaChecklistItemEntity item
            JOIN FETCH item.checklist
            WHERE item.id = :checklistItemId
            """)
    Optional<JpaChecklistItemEntity> findByIdWithChecklist(@Param("checklistItemId") Long checklistItemId);

    @Query("""
            SELECT CASE WHEN COUNT(item) > 0 THEN true ELSE false END
            FROM JpaChecklistItemEntity item
            WHERE item.id = :checklistItemId
              AND item.checklist.ownerId = :ownerId
            """)
    boolean existsByIdAndOwnerId(
            @Param("checklistItemId") Long checklistItemId,
            @Param("ownerId") Long ownerId
    );

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
            JOIN FETCH item.checklist checklist
            WHERE checklist.id = :checklistId
            """)
    List<JpaChecklistItemEntity> findByChecklistId(@Param("checklistId") Long checklistId);
}

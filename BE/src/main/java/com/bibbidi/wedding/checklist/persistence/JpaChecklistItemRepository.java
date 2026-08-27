package com.bibbidi.wedding.checklist.persistence;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JpaChecklistItemRepository extends JpaRepository<JpaChecklistItemEntity, Long> {

    @Query("""
            SELECT CASE WHEN COUNT(item) > 0 THEN true ELSE false END
            FROM JpaChecklistItemEntity item
            JOIN JpaChecklistEntity checklist ON checklist.id = item.checklistId
            WHERE item.id = :checklistItemId
              AND checklist.ownerId = :ownerId
            """)
    boolean existsByIdAndOwnerId(
            @Param("checklistItemId") Long checklistItemId,
            @Param("ownerId") Long ownerId
    );

    @Query("""
            SELECT item.sourceCatalogItemId
            FROM JpaChecklistItemEntity item
            JOIN JpaChecklistEntity checklist ON checklist.id = item.checklistId
            WHERE checklist.ownerId = :userId
              AND item.sourceCatalogItemId IS NOT NULL
            """)
    List<Long> findIncludedCatalogItemIds(@Param("userId") Long userId);

    List<JpaChecklistItemEntity> findByChecklistId(Long checklistId);
}

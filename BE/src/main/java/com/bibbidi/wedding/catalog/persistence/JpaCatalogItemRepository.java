package com.bibbidi.wedding.catalog.persistence;

import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemSnapshot;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface JpaCatalogItemRepository extends JpaRepository<JpaCatalogItemEntity, Long> {

    @Query("""
            SELECT new com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot(
                    item.id, item.title, category.name, step.displayOrder, step.name)
            FROM JpaCatalogItemEntity item
            JOIN JpaStepEntity step ON step.id = item.stepId
            JOIN JpaCategoryEntity category ON category.id = step.categoryId
            """)
    List<CatalogItemDetailSnapshot> findAllDetails();

    @Query("""
            SELECT new com.bibbidi.wedding.catalog.service.dto.CatalogItemSnapshot(
                    item.id, step.categoryId, item.title)
            FROM JpaCatalogItemEntity item
            JOIN JpaStepEntity step ON step.id = item.stepId
            JOIN JpaCategoryEntity category ON category.id = step.categoryId
            WHERE item.id IN :itemIds
            ORDER BY category.displayOrder, category.id, step.displayOrder, step.id, item.displayOrder, item.id
            """)
    List<CatalogItemSnapshot> findSnapshotsByIdIn(Collection<Long> itemIds);
}

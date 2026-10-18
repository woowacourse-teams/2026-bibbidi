package com.bibbidi.wedding.catalog.persistence;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface JpaCategoryRepository extends JpaRepository<JpaCategoryEntity, Long> {

    @Query("""
            SELECT new com.bibbidi.wedding.catalog.persistence.CatalogRow(category, step, item)
            FROM JpaCategoryEntity category
            LEFT JOIN JpaStepEntity step ON step.categoryId = category.id
            LEFT JOIN JpaCatalogItemEntity item ON item.stepId = step.id
            ORDER BY category.id, step.id, item.id
            """)
    List<CatalogRow> findAllRows();
}

package com.bibbidi.wedding.catalog;

import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemEntity;
import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemRepository;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryEntity;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryRepository;
import com.bibbidi.wedding.catalog.persistence.JpaStepEntity;
import com.bibbidi.wedding.catalog.persistence.JpaStepRepository;

public class CatalogTestFixture {

    private final JpaCategoryRepository categoryRepository;
    private final JpaStepRepository stepRepository;
    private final JpaCatalogItemRepository catalogItemRepository;

    public CatalogTestFixture(
            JpaCategoryRepository categoryRepository,
            JpaStepRepository stepRepository,
            JpaCatalogItemRepository catalogItemRepository
    ) {
        this.categoryRepository = categoryRepository;
        this.stepRepository = stepRepository;
        this.catalogItemRepository = catalogItemRepository;
    }

    public CatalogData createWeddingHallCatalog() {
        JpaCategoryEntity category = categoryRepository.saveAndFlush(
                new JpaCategoryEntity(null, "웨딩홀", 1)
        );
        JpaStepEntity step = stepRepository.saveAndFlush(
                new JpaStepEntity(null, category.id(), "웨딩홀 계약", "웨딩홀을 결정하고 계약한다.", 1)
        );
        JpaCatalogItemEntity catalogItem = catalogItemRepository.saveAndFlush(
                new JpaCatalogItemEntity(null, step.id(), "계약서 확인", 1, true)
        );

        return new CatalogData(category.id(), step.id(), catalogItem.id());
    }

    public void clear() {
        catalogItemRepository.deleteAllInBatch();
        stepRepository.deleteAllInBatch();
        categoryRepository.deleteAllInBatch();
    }

    public record CatalogData(
            Long categoryId,
            Long stepId,
            Long catalogItemId
    ) {
    }
}

package com.bibbidi.wedding.catalog.repository;

import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.domain.Category;
import com.bibbidi.wedding.catalog.domain.Item;
import com.bibbidi.wedding.catalog.domain.Step;
import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemEntity;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryEntity;
import com.bibbidi.wedding.catalog.persistence.JpaStepEntity;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class CatalogMapper {

    public Catalog toDomain(
            List<JpaCategoryEntity> categoryEntities,
            List<JpaStepEntity> stepEntities,
            List<JpaCatalogItemEntity> itemEntities
    ) {
        Map<Long, List<Item>> itemsByStepId = groupItemsByStepId(itemEntities);
        Map<Long, List<Step>> stepsByCategoryId = groupStepsByCategoryId(stepEntities, itemsByStepId);

        return new Catalog(categoryEntities.stream()
                .map(entity -> toCategory(entity, stepsByCategoryId))
                .toList());
    }

    private Map<Long, List<Item>> groupItemsByStepId(List<JpaCatalogItemEntity> itemEntities) {
        Map<Long, List<Item>> itemsByStepId = new LinkedHashMap<>();
        for (JpaCatalogItemEntity entity : itemEntities) {
            itemsByStepId.computeIfAbsent(entity.stepId(), ignored -> new ArrayList<>())
                    .add(toItem(entity));
        }
        return itemsByStepId;
    }

    private Map<Long, List<Step>> groupStepsByCategoryId(
            List<JpaStepEntity> stepEntities,
            Map<Long, List<Item>> itemsByStepId
    ) {
        Map<Long, List<Step>> stepsByCategoryId = new LinkedHashMap<>();
        for (JpaStepEntity entity : stepEntities) {
            stepsByCategoryId.computeIfAbsent(entity.categoryId(), ignored -> new ArrayList<>())
                    .add(toStep(entity, itemsByStepId.getOrDefault(entity.id(), List.of())));
        }
        return stepsByCategoryId;
    }

    private Category toCategory(JpaCategoryEntity entity, Map<Long, List<Step>> stepsByCategoryId) {
        return new Category(
                entity.id(),
                entity.name(),
                entity.displayOrder(),
                stepsByCategoryId.getOrDefault(entity.id(), List.of())
        );
    }

    private Step toStep(JpaStepEntity entity, List<Item> items) {
        return new Step(
                entity.id(),
                entity.name(),
                entity.description(),
                entity.displayOrder(),
                items
        );
    }

    private Item toItem(JpaCatalogItemEntity entity) {
        return new Item(
                entity.id(),
                entity.title(),
                entity.displayOrder(),
                entity.essential()
        );
    }
}

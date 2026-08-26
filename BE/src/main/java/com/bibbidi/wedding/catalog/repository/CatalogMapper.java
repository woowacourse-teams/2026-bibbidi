package com.bibbidi.wedding.catalog.repository;

import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.domain.Category;
import com.bibbidi.wedding.catalog.domain.Item;
import com.bibbidi.wedding.catalog.domain.Step;
import com.bibbidi.wedding.catalog.persistence.CatalogRow;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class CatalogMapper {

    public Catalog toDomain(List<CatalogRow> rows) {
        Map<Long, CategoryBuilder> categories = new LinkedHashMap<>();

        for (CatalogRow row : rows) {
            CategoryBuilder category = categories.computeIfAbsent(
                    row.categoryId(),
                    ignored -> new CategoryBuilder(
                            row.categoryId(),
                            row.categoryName(),
                            row.categoryDisplayOrder()
                    )
            );

            category.add(row);
        }

        return new Catalog(categories.values().stream()
                .map(CategoryBuilder::build)
                .toList());
    }

    private static final class CategoryBuilder {

        private final Long id;
        private final String name;
        private final int displayOrder;
        private final Map<Long, StepBuilder> steps = new LinkedHashMap<>();

        private CategoryBuilder(Long id, String name, int displayOrder) {
            this.id = id;
            this.name = name;
            this.displayOrder = displayOrder;
        }

        private void add(CatalogRow row) {
            if (row.stepId() == null) {
                return;
            }

            StepBuilder step = steps.computeIfAbsent(
                    row.stepId(),
                    ignored -> new StepBuilder(
                            row.stepId(),
                            row.stepName(),
                            row.stepDescription(),
                            row.stepDisplayOrder()
                    )
            );

            step.add(row);
        }

        private Category build() {
            return new Category(
                    id,
                    name,
                    displayOrder,
                    steps.values().stream()
                            .map(StepBuilder::build)
                            .toList()
            );
        }
    }

    private static final class StepBuilder {

        private final Long id;
        private final String name;
        private final String description;
        private final int displayOrder;
        private final List<Item> items = new ArrayList<>();

        private StepBuilder(Long id, String name, String description, int displayOrder) {
            this.id = id;
            this.name = name;
            this.description = description;
            this.displayOrder = displayOrder;
        }

        private void add(CatalogRow row) {
            if (row.itemId() == null) {
                return;
            }

            items.add(new Item(
                    row.itemId(),
                    row.itemTitle(),
                    row.itemDisplayOrder(),
                    row.itemEssential()
            ));
        }

        private Step build() {
            return new Step(id, name, description, displayOrder, items);
        }
    }
}

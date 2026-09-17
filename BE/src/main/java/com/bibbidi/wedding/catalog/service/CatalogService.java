package com.bibbidi.wedding.catalog.service;

import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.domain.Category;
import com.bibbidi.wedding.catalog.repository.CatalogRepository;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemSnapshot;
import com.bibbidi.wedding.catalog.service.dto.CategoryNames;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CatalogService {

    private final CatalogRepository catalogRepository;

    public CatalogService(CatalogRepository catalogRepository) {
        this.catalogRepository = catalogRepository;
    }

    @Transactional(readOnly = true)
    public List<CatalogItemSnapshot> findItems(Collection<Long> itemIds) {
        Catalog catalog = catalogRepository.findCatalog();

        return catalog.categories().stream()
                .flatMap(category -> category.findItems(itemIds).stream()
                        .map(item -> new CatalogItemSnapshot(item.id(), category.id(), item.title())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CatalogItemDetailSnapshot> findAllItemDetails() {
        return catalogRepository.findAllItemDetails();
    }

    @Transactional(readOnly = true)
    public CategoryNames findCategoryNames(Collection<Long> categoryIds) {
        Catalog catalog = catalogRepository.findCatalog();

        Map<Long, String> namesByCategoryId = catalog.categories().stream()
                .filter(category -> categoryIds.contains(category.id()))
                .collect(Collectors.toMap(Category::id, Category::name));
        return new CategoryNames(namesByCategoryId);
    }

    @Transactional(readOnly = true)
    public void validateCategoryExists(Long categoryId) {
        catalogRepository.validateCategoryExists(categoryId);
    }

    @Transactional(readOnly = true)
    public Catalog find() {
        return catalogRepository.findCatalog();
    }
}

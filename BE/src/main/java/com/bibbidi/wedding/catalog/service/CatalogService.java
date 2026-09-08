package com.bibbidi.wedding.catalog.service;

import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.repository.CatalogRepository;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemSnapshot;
import java.util.Collection;
import java.util.List;
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
    public void validateCategoryExists(Long categoryId) {
        catalogRepository.validateCategoryExists(categoryId);
    }

    @Transactional(readOnly = true)
    public Catalog find() {
        return catalogRepository.findCatalog();
    }
}

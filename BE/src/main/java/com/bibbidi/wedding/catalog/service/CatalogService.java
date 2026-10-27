package com.bibbidi.wedding.catalog.service;

import com.bibbidi.wedding.catalog.config.CatalogCacheConfig;
import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.repository.CatalogRepository;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemSnapshot;
import com.bibbidi.wedding.catalog.service.dto.CategoryNameSnapshot;
import com.bibbidi.wedding.catalog.service.dto.CategoryNames;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.cache.annotation.Cacheable;
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
        return catalogRepository.findItems(itemIds);
    }

    @Transactional(readOnly = true)
    public List<CatalogItemDetailSnapshot> findAllItemDetails() {
        return catalogRepository.findAllItemDetails();
    }

    @Transactional(readOnly = true)
    public CategoryNames findCategoryNames(Collection<Long> categoryIds) {
        Map<Long, String> namesByCategoryId = catalogRepository.findCategoryNames(categoryIds).stream()
                .collect(Collectors.toMap(CategoryNameSnapshot::id, CategoryNameSnapshot::name));
        return new CategoryNames(namesByCategoryId);
    }

    @Transactional(readOnly = true)
    public void validateCategoryExists(Long categoryId) {
        catalogRepository.validateCategoryExists(categoryId);
    }

    @Cacheable(cacheNames = CatalogCacheConfig.CATALOG_CACHE, cacheManager = "catalogCacheManager", key = "'all'", sync = true)
    @Transactional(readOnly = true)
    public Catalog find() {
        return catalogRepository.findCatalog();
    }
}

package com.bibbidi.wedding.catalog.service;

import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.repository.CatalogItemInclusionRepository;
import com.bibbidi.wedding.catalog.repository.CatalogRepository;
import com.bibbidi.wedding.catalog.service.dto.CatalogQueryResult;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CatalogService {

    private final CatalogRepository catalogRepository;
    private final CatalogItemInclusionRepository catalogItemInclusionRepository;

    public CatalogService(
            CatalogRepository catalogRepository,
            CatalogItemInclusionRepository catalogItemInclusionRepository
    ) {
        this.catalogRepository = catalogRepository;
        this.catalogItemInclusionRepository = catalogItemInclusionRepository;
    }

    @Transactional(readOnly = true)
    public CatalogQueryResult find(Long userId) {
        Catalog catalog = catalogRepository.findCatalog();
        Set<Long> includedCatalogItemIds = catalogItemInclusionRepository.findIncludedItemIds(userId);

        return new CatalogQueryResult(catalog, includedCatalogItemIds);
    }

    @Transactional(readOnly = true)
    public Catalog findPublicCatalog() {
        return catalogRepository.findCatalog();
    }
}

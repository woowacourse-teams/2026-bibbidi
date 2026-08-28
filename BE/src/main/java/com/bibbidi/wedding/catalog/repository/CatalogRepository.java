package com.bibbidi.wedding.catalog.repository;

import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemRepository;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryRepository;
import com.bibbidi.wedding.catalog.persistence.JpaStepRepository;
import org.springframework.stereotype.Repository;

@Repository
public class CatalogRepository {

    private final JpaCategoryRepository jpaCategoryRepository;
    private final JpaStepRepository jpaStepRepository;
    private final JpaCatalogItemRepository jpaCatalogItemRepository;
    private final CatalogMapper catalogMapper;

    public CatalogRepository(
            JpaCategoryRepository jpaCategoryRepository,
            JpaStepRepository jpaStepRepository,
            JpaCatalogItemRepository jpaCatalogItemRepository,
            CatalogMapper catalogMapper
    ) {
        this.jpaCategoryRepository = jpaCategoryRepository;
        this.jpaStepRepository = jpaStepRepository;
        this.jpaCatalogItemRepository = jpaCatalogItemRepository;
        this.catalogMapper = catalogMapper;
    }

    public Catalog findCatalog() {
        return catalogMapper.toDomain(
                jpaCategoryRepository.findAll(),
                jpaStepRepository.findAll(),
                jpaCatalogItemRepository.findAll()
        );
    }
}

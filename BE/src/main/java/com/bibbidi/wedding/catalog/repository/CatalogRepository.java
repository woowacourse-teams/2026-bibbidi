package com.bibbidi.wedding.catalog.repository;

import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemRepository;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryRepository;
import com.bibbidi.wedding.catalog.persistence.JpaStepRepository;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
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

    public void validateCategoryExists(Long categoryId) {
        if (!jpaCategoryRepository.existsById(categoryId)) {
            throw new BusinessException(
                    ClientError.CATEGORY_NOT_FOUND,
                    "준비 목록에 없는 카테고리입니다. categoryId=" + categoryId
            );
        }
    }

    public Catalog findCatalog() {
        return catalogMapper.toDomain(
                jpaCategoryRepository.findAll(),
                jpaStepRepository.findAll(),
                jpaCatalogItemRepository.findAll()
        );
    }
}

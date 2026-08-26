package com.bibbidi.wedding.catalog.repository;

import com.bibbidi.wedding.catalog.persistence.CatalogItemInclusionDao;
import java.util.Set;
import org.springframework.stereotype.Repository;

@Repository
public class CatalogItemInclusionRepository {

    private final CatalogItemInclusionDao catalogItemInclusionDao;

    public CatalogItemInclusionRepository(CatalogItemInclusionDao catalogItemInclusionDao) {
        this.catalogItemInclusionDao = catalogItemInclusionDao;
    }

    public Set<Long> findIncludedItemIds(Long userId) {
        return catalogItemInclusionDao.findIncludedItemIds(userId);
    }
}

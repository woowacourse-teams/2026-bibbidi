package com.bibbidi.wedding.catalog.repository;

import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.persistence.CatalogDao;
import org.springframework.stereotype.Repository;

@Repository
public class CatalogRepository {

    private final CatalogDao catalogDao;
    private final CatalogMapper catalogMapper;

    public CatalogRepository(CatalogDao catalogDao, CatalogMapper catalogMapper) {
        this.catalogDao = catalogDao;
        this.catalogMapper = catalogMapper;
    }

    public Catalog findCatalog() {
        return catalogMapper.toDomain(catalogDao.findCatalogRows());
    }
}

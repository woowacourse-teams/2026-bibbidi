package com.bibbidi.wedding.catalog.repository;

import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemSnapshot;
import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemEntity;
import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemRepository;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryRepository;
import com.bibbidi.wedding.catalog.persistence.JpaStepEntity;
import com.bibbidi.wedding.catalog.persistence.JpaStepRepository;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
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

    public List<CatalogItemSnapshot> findItemSnapshots(Collection<Long> itemIds) {
        List<JpaCatalogItemEntity> itemEntities = jpaCatalogItemRepository.findAllById(itemIds);
        Map<Long, Long> categoryIdByStepId = findCategoryIdByStepId(itemEntities);

        return itemEntities.stream()
                .map(entity -> catalogMapper.toSnapshot(entity, categoryIdByStepId.get(entity.stepId())))
                .toList();
    }

    private Map<Long, Long> findCategoryIdByStepId(List<JpaCatalogItemEntity> itemEntities) {
        List<Long> stepIds = itemEntities.stream()
                .map(JpaCatalogItemEntity::stepId)
                .distinct()
                .toList();

        return jpaStepRepository.findAllById(stepIds).stream()
                .collect(Collectors.toMap(JpaStepEntity::id, JpaStepEntity::categoryId));
    }

    public Catalog findCatalog() {
        return catalogMapper.toDomain(
                jpaCategoryRepository.findAll(),
                jpaStepRepository.findAll(),
                jpaCatalogItemRepository.findAll()
        );
    }
}

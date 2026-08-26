package com.bibbidi.wedding.catalog.repository;

import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.stereotype.Repository;

@Repository
public class CatalogItemInclusionRepository {

    private final JpaChecklistItemRepository jpaChecklistItemRepository;

    public CatalogItemInclusionRepository(JpaChecklistItemRepository jpaChecklistItemRepository) {
        this.jpaChecklistItemRepository = jpaChecklistItemRepository;
    }

    public Set<Long> findIncludedItemIds(Long userId) {
        return new LinkedHashSet<>(jpaChecklistItemRepository.findIncludedCatalogItemIds(userId));
    }
}

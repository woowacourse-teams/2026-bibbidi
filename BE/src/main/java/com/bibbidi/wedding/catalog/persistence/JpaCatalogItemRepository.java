package com.bibbidi.wedding.catalog.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface JpaCatalogItemRepository extends JpaRepository<JpaCatalogItemEntity, Long> {
}

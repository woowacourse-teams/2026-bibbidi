package com.bibbidi.wedding.catalog.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemEntity;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryEntity;
import com.bibbidi.wedding.catalog.persistence.JpaStepEntity;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CatalogMapperTest {

    private final CatalogMapper catalogMapper = new CatalogMapper();

    @Test
    @DisplayName("따로 조회한 Entity들을 준비 목록 계층 구조로 복원한다")
    void shouldRestoreCatalogHierarchyFromEntities() {
        // given
        List<JpaCategoryEntity> categoryEntities = List.of(
                new JpaCategoryEntity(1L, "웨딩홀", 1),
                new JpaCategoryEntity(2L, "스드메", 2)
        );
        List<JpaStepEntity> stepEntities = List.of(
                new JpaStepEntity(10L, 1L, "계약", "계약 단계", 1)
        );
        List<JpaCatalogItemEntity> itemEntities = List.of(
                new JpaCatalogItemEntity(101L, 10L, "계약서 확인", 1, true),
                new JpaCatalogItemEntity(102L, 10L, "계약금 납부", 2, true)
        );

        // when
        Catalog catalog = catalogMapper.toDomain(categoryEntities, stepEntities, itemEntities);

        // then
        assertThat(catalog.categories()).hasSize(2);
        assertThat(catalog.categories().getFirst().steps()).hasSize(1);
        assertThat(catalog.categories().getFirst().steps().getFirst().items()).hasSize(2);
        assertThat(catalog.categories().getLast().steps()).isEmpty();
    }
}

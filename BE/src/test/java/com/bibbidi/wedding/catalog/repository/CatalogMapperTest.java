package com.bibbidi.wedding.catalog.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.persistence.CatalogRow;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CatalogMapperTest {

    private final CatalogMapper catalogMapper = new CatalogMapper();

    @Test
    @DisplayName("평평한 조회 결과를 준비 목록 계층 구조로 복원한다")
    void shouldRestoreCatalogHierarchyFromFlatRows() {
        // given
        List<CatalogRow> rows = List.of(
                new CatalogRow(1L, "웨딩홀", 1, 10L, "계약", "계약 단계", 1,
                        101L, "계약서 확인", 1, true),
                new CatalogRow(1L, "웨딩홀", 1, 10L, "계약", "계약 단계", 1,
                        102L, "계약금 납부", 2, true),
                new CatalogRow(2L, "스드메", 2, null, null, null, null,
                        null, null, null, null)
        );

        // when
        Catalog catalog = catalogMapper.toDomain(rows);

        // then
        assertThat(catalog.categories()).hasSize(2);
        assertThat(catalog.categories().getFirst().steps()).hasSize(1);
        assertThat(catalog.categories().getFirst().steps().getFirst().items()).hasSize(2);
        assertThat(catalog.categories().getLast().steps()).isEmpty();
    }
}

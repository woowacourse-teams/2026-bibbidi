package com.bibbidi.wedding.catalog.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemRepository;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryRepository;
import com.bibbidi.wedding.catalog.persistence.JpaStepRepository;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CatalogRepositoryUnitTest {

    private final JpaCategoryRepository jpaCategoryRepository = mock(JpaCategoryRepository.class);
    private final JpaStepRepository jpaStepRepository = mock(JpaStepRepository.class);
    private final JpaCatalogItemRepository jpaCatalogItemRepository = mock(JpaCatalogItemRepository.class);
    private final CatalogMapper catalogMapper = mock(CatalogMapper.class);
    private final CatalogRepository catalogRepository = new CatalogRepository(
            jpaCategoryRepository, jpaStepRepository, jpaCatalogItemRepository, catalogMapper
    );

    @Test
    @DisplayName("빈 카테고리 ID 모음은 DB 조회와 카탈로그 구성 없이 빈 결과를 반환한다")
    void shouldSkipDatabaseForEmptyCategoryIds() {
        assertThat(catalogRepository.findCategoryNames(List.of())).isEmpty();

        verifyNoInteractions(jpaCategoryRepository, jpaStepRepository, jpaCatalogItemRepository, catalogMapper);
    }
}

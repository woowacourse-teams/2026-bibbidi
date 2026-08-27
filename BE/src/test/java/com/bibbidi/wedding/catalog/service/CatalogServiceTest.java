package com.bibbidi.wedding.catalog.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.domain.Category;
import com.bibbidi.wedding.catalog.domain.Item;
import com.bibbidi.wedding.catalog.domain.Step;
import com.bibbidi.wedding.catalog.repository.CatalogItemInclusionRepository;
import com.bibbidi.wedding.catalog.repository.CatalogRepository;
import com.bibbidi.wedding.catalog.service.dto.CatalogQueryResult;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CatalogServiceTest {

    private static final Long USER_ID = 7L;
    private static final Long INCLUDED_ITEM_ID = 1L;
    private static final Long EXCLUDED_ITEM_ID = 2L;

    private final CatalogRepository catalogRepository = mock(CatalogRepository.class);
    private final CatalogItemInclusionRepository catalogItemInclusionRepository =
            mock(CatalogItemInclusionRepository.class);
    private final CatalogService catalogService =
            new CatalogService(catalogRepository, catalogItemInclusionRepository);

    private static Catalog constructTestCatalog() {
        Item includedItem = new Item(INCLUDED_ITEM_ID, "포함된 할 일", 1, true);
        Item excludedItem = new Item(EXCLUDED_ITEM_ID, "포함되지 않은 할 일", 2, false);
        Step step = new Step(1L, "계약", null, 1, List.of(includedItem, excludedItem));
        return new Catalog(List.of(new Category(1L, "웨딩홀", 1, List.of(step))));
    }

    @Test
    @DisplayName("준비 목록과 사용자의 체크리스트에 포함된 카탈로그 항목 ID를 조회한다")
    void shouldFindCatalogAndIncludedCatalogItemIds() {
        // given
        Catalog catalog = constructTestCatalog();
        when(catalogRepository.findCatalog()).thenReturn(catalog);
        when(catalogItemInclusionRepository.findIncludedItemIds(USER_ID))
                .thenReturn(Set.of(INCLUDED_ITEM_ID));

        // when
        CatalogQueryResult result = catalogService.find(USER_ID);

        // then
        assertThat(result.catalog()).isSameAs(catalog);
        assertThat(result.includedCatalogItemIds()).containsExactly(INCLUDED_ITEM_ID);
    }

    @Test
    @DisplayName("사용자 없이 준비 목록만 조회한다")
    void shouldFindCatalogWithoutUser() {
        // given
        Catalog catalog = constructTestCatalog();
        when(catalogRepository.findCatalog()).thenReturn(catalog);

        // when
        Catalog publicCatalog = catalogService.findPublicCatalog();

        // then
        assertThat(publicCatalog).isSameAs(catalog);
        verifyNoInteractions(catalogItemInclusionRepository);
    }
}

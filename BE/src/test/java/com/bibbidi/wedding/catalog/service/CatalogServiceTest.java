package com.bibbidi.wedding.catalog.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.domain.Category;
import com.bibbidi.wedding.catalog.domain.Item;
import com.bibbidi.wedding.catalog.domain.Step;
import com.bibbidi.wedding.catalog.repository.CatalogItemInclusionRepository;
import com.bibbidi.wedding.catalog.repository.CatalogRepository;
import com.bibbidi.wedding.catalog.service.dto.CatalogQueryResult;
import com.bibbidi.wedding.catalog.service.dto.ItemResult;
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
    @DisplayName("준비 목록에 사용자의 체크리스트 포함 여부를 함께 표시한다")
    void shouldMarkWhetherItemIsIncludedInUserChecklist() {
        // given
        when(catalogRepository.findCatalog()).thenReturn(constructTestCatalog());
        when(catalogItemInclusionRepository.findIncludedItemIds(USER_ID))
                .thenReturn(Set.of(INCLUDED_ITEM_ID));

        // when
        CatalogQueryResult result = catalogService.find(USER_ID);

        // then
        assertThat(result.categories().getFirst().steps().getFirst().items())
                .extracting(ItemResult::id, ItemResult::included)
                .containsExactly(
                        tuple(INCLUDED_ITEM_ID, true),
                        tuple(EXCLUDED_ITEM_ID, false)
                );
    }
}

package com.bibbidi.wedding.catalog.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.domain.Category;
import com.bibbidi.wedding.catalog.domain.Item;
import com.bibbidi.wedding.catalog.domain.Step;
import com.bibbidi.wedding.catalog.repository.CatalogRepository;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemSnapshot;
import com.bibbidi.wedding.catalog.service.dto.CategoryNames;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CatalogServiceTest {

    private static final Long FIRST_ITEM_ID = 1L;
    private static final Long SECOND_ITEM_ID = 2L;

    private final CatalogRepository catalogRepository = mock(CatalogRepository.class);
    private final CatalogService catalogService = new CatalogService(catalogRepository);

    private static Catalog constructTestCatalog() {
        Item firstItem = new Item(FIRST_ITEM_ID, "첫 번째 할 일", 1, true);
        Item secondItem = new Item(SECOND_ITEM_ID, "두 번째 할 일", 2, false);
        Step step = new Step(1L, "계약", null, null, 1, List.of(firstItem, secondItem));
        return new Catalog(List.of(new Category(1L, "웨딩홀", 1, List.of(step))));
    }

    @Test
    @DisplayName("준비 목록을 조회한다")
    void shouldFindCatalog() {
        // given
        Catalog catalog = constructTestCatalog();
        when(catalogRepository.findCatalog()).thenReturn(catalog);

        // when
        Catalog found = catalogService.find();

        // then
        assertThat(found).isSameAs(catalog);
    }

    @Test
    @DisplayName("준비 목록에서 선택한 항목을 조회한다")
    void shouldFindItems() {
        // given
        Catalog catalog = constructTestCatalog();
        when(catalogRepository.findCatalog()).thenReturn(catalog);

        // when
        List<CatalogItemSnapshot> snapshots = catalogService.findItems(List.of(FIRST_ITEM_ID));

        // then
        assertThat(snapshots)
                .singleElement()
                .extracting(CatalogItemSnapshot::id, CatalogItemSnapshot::categoryId, CatalogItemSnapshot::title)
                .containsExactly(FIRST_ITEM_ID, 1L, "첫 번째 할 일");
    }

    @Test
    @DisplayName("요청한 카테고리 중 준비 목록에 있는 카테고리의 이름만 조회한다")
    void shouldFindCategoryNames() {
        // given
        Catalog catalog = new Catalog(List.of(
                new Category(1L, "웨딩홀", 1, List.of()),
                new Category(2L, "드레스", 2, List.of())
        ));
        when(catalogRepository.findCatalog()).thenReturn(catalog);

        // when
        CategoryNames categoryNames = catalogService.findCategoryNames(Set.of(1L, 99L));

        // then
        assertThat(categoryNames).isEqualTo(new CategoryNames(Map.of(1L, "웨딩홀")));
    }

    @Test
    @DisplayName("카테고리 존재 검증을 카탈로그 저장소에 위임한다")
    void shouldValidateCategoryExists() {
        // when
        catalogService.validateCategoryExists(1L);

        // then
        verify(catalogRepository).validateCategoryExists(1L);
    }
}

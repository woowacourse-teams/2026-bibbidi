package com.bibbidi.wedding.catalog.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.domain.Category;
import com.bibbidi.wedding.catalog.domain.Item;
import com.bibbidi.wedding.catalog.domain.Step;
import com.bibbidi.wedding.catalog.repository.CatalogRepository;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemSnapshot;
import com.bibbidi.wedding.catalog.service.dto.CategoryNameSnapshot;
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
        List<Long> itemIds = List.of(FIRST_ITEM_ID);
        when(catalogRepository.findItems(itemIds))
                .thenReturn(List.of(new CatalogItemSnapshot(FIRST_ITEM_ID, 1L, "첫 번째 할 일")));

        // when
        List<CatalogItemSnapshot> snapshots = catalogService.findItems(itemIds);

        // then
        assertThat(snapshots)
                .singleElement()
                .extracting(CatalogItemSnapshot::id, CatalogItemSnapshot::categoryId, CatalogItemSnapshot::title)
                .containsExactly(FIRST_ITEM_ID, 1L, "첫 번째 할 일");
    }

    @Test
    @DisplayName("준비 항목 전체를 카테고리와 단계 정보와 함께 조회한다")
    void shouldFindAllItemDetails() {
        // given
        List<CatalogItemDetailSnapshot> itemDetails = List.of(
                new CatalogItemDetailSnapshot(FIRST_ITEM_ID, "첫 번째 할 일", "웨딩홀", 1, "계약")
        );
        when(catalogRepository.findAllItemDetails()).thenReturn(itemDetails);

        // when
        List<CatalogItemDetailSnapshot> found = catalogService.findAllItemDetails();

        // then
        assertThat(found).isEqualTo(itemDetails);
    }

    @Test
    @DisplayName("요청한 카테고리 중 준비 목록에 있는 카테고리의 이름만 조회한다")
    void shouldFindCategoryNames() {
        // given
        Set<Long> categoryIds = Set.of(1L, 99L);
        when(catalogRepository.findCategoryNames(categoryIds))
                .thenReturn(List.of(new CategoryNameSnapshot(1L, "웨딩홀")));

        // when
        CategoryNames categoryNames = catalogService.findCategoryNames(categoryIds);

        // then
        assertThat(categoryNames).isEqualTo(new CategoryNames(Map.of(1L, "웨딩홀")));
        assertThat(categoryNames.nameOf(99L)).isNull();
        verify(catalogRepository).findCategoryNames(categoryIds);
        verifyNoMoreInteractions(catalogRepository);
    }

    @Test
    @DisplayName("빈 카테고리 조회 결과는 빈 이름 모음으로 돌려준다")
    void shouldReturnEmptyCategoryNames() {
        // given
        when(catalogRepository.findCategoryNames(List.of())).thenReturn(List.of());

        // when
        CategoryNames categoryNames = catalogService.findCategoryNames(List.of());

        // then
        assertThat(categoryNames).isEqualTo(new CategoryNames(Map.of()));
        verify(catalogRepository).findCategoryNames(List.of());
        verifyNoMoreInteractions(catalogRepository);
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

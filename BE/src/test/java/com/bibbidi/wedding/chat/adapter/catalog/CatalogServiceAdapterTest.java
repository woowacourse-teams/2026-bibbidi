package com.bibbidi.wedding.chat.adapter.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.repository.CatalogRepository;
import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CatalogServiceAdapterTest {

    private CatalogRepository catalogRepository;
    private CatalogServiceAdapter adapter;

    @BeforeEach
    void setUp() {
        catalogRepository = mock(CatalogRepository.class);
        adapter = new CatalogServiceAdapter(new CatalogService(catalogRepository));
    }

    @Test
    @DisplayName("저장된 카탈로그 항목 상세를 모두 조회한다")
    void findsAllCatalogItemDetails() {
        // given
        List<CatalogItemDetailSnapshot> stored = List.of(
                new CatalogItemDetailSnapshot(1L, "웨딩홀 후보 정하기", "웨딩홀", 1, "후보"),
                new CatalogItemDetailSnapshot(2L, "스튜디오 후보 정하기", "촬영", 1, "후보"));
        when(catalogRepository.findAllItemDetails()).thenReturn(stored);

        // when
        List<CatalogItemDetailSnapshot> details = adapter.findAllItemDetails();

        // then
        assertThat(details).containsExactlyElementsOf(stored);
    }

    @Test
    @DisplayName("카탈로그가 비어 있으면 빈 목록을 돌려준다")
    void returnsEmptyWhenThereAreNoCatalogItems() {
        // given
        when(catalogRepository.findAllItemDetails()).thenReturn(List.of());

        // when, then
        assertThat(adapter.findAllItemDetails()).isEmpty();
    }
}

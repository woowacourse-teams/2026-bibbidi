package com.bibbidi.wedding.catalog.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.domain.Category;
import com.bibbidi.wedding.catalog.domain.Item;
import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemEntity;
import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemRepository;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryEntity;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryRepository;
import com.bibbidi.wedding.catalog.persistence.JpaStepEntity;
import com.bibbidi.wedding.catalog.persistence.JpaStepRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
@Import({CatalogRepository.class, CatalogMapper.class})
class CatalogRepositoryTest {

    @Autowired
    private CatalogRepository catalogRepository;

    @Autowired
    private JpaCategoryRepository jpaCategoryRepository;

    @Autowired
    private JpaStepRepository jpaStepRepository;

    @Autowired
    private JpaCatalogItemRepository jpaCatalogItemRepository;

    @Test
    @DisplayName("단계가 없는 준비 영역까지 포함해 준비 목록을 조회한다")
    void shouldFindCatalogIncludingCategoryWithoutStep() {
        // given
        JpaCategoryEntity weddingHall = jpaCategoryRepository.save(new JpaCategoryEntity(null, "웨딩홀", 1));
        JpaCategoryEntity studio = jpaCategoryRepository.save(new JpaCategoryEntity(null, "스드메", 2));
        JpaStepEntity contract = jpaStepRepository.save(new JpaStepEntity(
                null, weddingHall.id(), "웨딩홀 계약", "웨딩홀을 결정하고 계약한다.", 1
        ));
        JpaCatalogItemEntity item = jpaCatalogItemRepository.save(new JpaCatalogItemEntity(
                null, contract.id(), "계약서 확인", 1, true
        ));

        // when
        Catalog catalog = catalogRepository.findCatalog();

        // then
        assertThat(catalog.categories())
                .extracting(Category::id)
                .containsExactly(weddingHall.id(), studio.id());
        assertThat(catalog.categories().getFirst().steps().getFirst().items())
                .extracting(Item::id)
                .containsExactly(item.id());
        assertThat(catalog.categories().getLast().steps()).isEmpty();
    }
}

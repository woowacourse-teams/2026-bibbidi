package com.bibbidi.wedding.catalog.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
@Import(CatalogItemInclusionRepository.class)
class CatalogItemInclusionRepositoryTest {

    private static final Long OWNER_ID = 7L;
    private static final Long OTHER_USER_ID = 8L;
    private static final Long CATALOG_ITEM_ID = 100L;
    private static final Long CATEGORY_ID = 1L;

    @Autowired
    private CatalogItemInclusionRepository catalogItemInclusionRepository;

    @Autowired
    private JpaChecklistRepository jpaChecklistRepository;

    @Autowired
    private JpaChecklistItemRepository jpaChecklistItemRepository;

    @BeforeEach
    void setUp() {
        JpaChecklistEntity checklist = jpaChecklistRepository.save(new JpaChecklistEntity(null, OWNER_ID));
        jpaChecklistItemRepository.save(new JpaChecklistItemEntity(
                null, checklist.id(), CATEGORY_ID, CATALOG_ITEM_ID, "계약서 확인", ChecklistItemStatus.PREV
        ));
        jpaChecklistItemRepository.save(new JpaChecklistItemEntity(
                null, checklist.id(), CATEGORY_ID, null, "직접 만든 할 일", ChecklistItemStatus.PREV
        ));
    }

    @Test
    @DisplayName("직접 만든 할 일을 제외하고 준비 목록에서 가져온 항목만 조회한다")
    void shouldFindOnlyItemIdsCameFromCatalog() {
        // when, then
        assertThat(catalogItemInclusionRepository.findIncludedItemIds(OWNER_ID))
                .containsExactly(CATALOG_ITEM_ID);
    }

    @Test
    @DisplayName("체크리스트가 없는 사용자를 조회해도 데이터를 만들지 않는다")
    void shouldNotCreateChecklistWhenUserHasNone() {
        // when
        assertThat(catalogItemInclusionRepository.findIncludedItemIds(OTHER_USER_ID)).isEmpty();

        // then
        assertThat(jpaChecklistRepository.count()).isEqualTo(1);
    }
}

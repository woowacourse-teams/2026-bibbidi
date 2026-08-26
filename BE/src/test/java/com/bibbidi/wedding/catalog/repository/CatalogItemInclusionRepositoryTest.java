package com.bibbidi.wedding.catalog.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.catalog.persistence.CatalogItemInclusionDao;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;

@DataJpaTest
@ActiveProfiles("test")
@Import({CatalogItemInclusionRepository.class, CatalogItemInclusionDao.class})
@Sql("/catalog-schema.sql")
class CatalogItemInclusionRepositoryTest {

    private static final Long OWNER_ID = 7L;
    private static final Long OTHER_USER_ID = 8L;

    @Autowired
    private CatalogItemInclusionRepository catalogItemInclusionRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("INSERT INTO checklists(id, owner_id) VALUES (1000, 7)");
        jdbcTemplate.update("""
                INSERT INTO checklist_items(id, checklist_id, source_catalog_item_id)
                VALUES (10000, 1000, 100)
                """);
        jdbcTemplate.update("""
                INSERT INTO checklist_items(id, checklist_id, source_catalog_item_id)
                VALUES (10001, 1000, NULL)
                """);
    }

    @Test
    @DisplayName("직접 만든 할 일을 제외하고 준비 목록에서 가져온 항목만 조회한다")
    void shouldFindOnlyItemIdsCameFromCatalog() {
        // when, then
        assertThat(catalogItemInclusionRepository.findIncludedItemIds(OWNER_ID)).containsExactly(100L);
    }

    @Test
    @DisplayName("체크리스트가 없는 사용자를 조회해도 데이터를 만들지 않는다")
    void shouldNotCreateChecklistWhenUserHasNone() {
        // when
        assertThat(catalogItemInclusionRepository.findIncludedItemIds(OTHER_USER_ID)).isEmpty();

        // then
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM checklists", Integer.class))
                .isEqualTo(1);
    }
}

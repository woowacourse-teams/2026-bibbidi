package com.bibbidi.wedding.catalog.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.domain.Category;
import com.bibbidi.wedding.catalog.domain.Item;
import com.bibbidi.wedding.catalog.persistence.CatalogDao;
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
@Import({CatalogRepository.class, CatalogMapper.class, CatalogDao.class})
@Sql("/catalog-schema.sql")
class CatalogRepositoryTest {

    @Autowired
    private CatalogRepository catalogRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("INSERT INTO categories(id, name, display_order) VALUES (1, '웨딩홀', 1)");
        jdbcTemplate.update("INSERT INTO categories(id, name, display_order) VALUES (2, '스드메', 2)");
        jdbcTemplate.update("""
                INSERT INTO steps(id, category_id, name, description, display_order)
                VALUES (10, 1, '웨딩홀 계약', '웨딩홀을 결정하고 계약한다.', 1)
                """);
        jdbcTemplate.update("""
                INSERT INTO catalog_items(id, step_id, title, display_order, essential)
                VALUES (100, 10, '계약서 확인', 1, TRUE)
                """);
    }

    @Test
    @DisplayName("단계가 없는 준비 영역까지 포함해 준비 목록을 조회한다")
    void shouldFindCatalogIncludingCategoryWithoutStep() {
        // when
        Catalog catalog = catalogRepository.findCatalog();

        // then
        assertThat(catalog.categories()).extracting(Category::id).containsExactly(1L, 2L);
        assertThat(catalog.categories().getFirst().steps().getFirst().items())
                .extracting(Item::id)
                .containsExactly(100L);
        assertThat(catalog.categories().getLast().steps()).isEmpty();
    }
}

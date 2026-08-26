package com.bibbidi.wedding.catalog.persistence;

import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class CatalogItemInclusionDao {

    private static final String FIND_INCLUDED_ITEM_IDS = """
            SELECT ci.source_catalog_item_id
            FROM checklists c
            JOIN checklist_items ci ON ci.checklist_id = c.id
            WHERE c.owner_id = ?
              AND ci.source_catalog_item_id IS NOT NULL
            """;

    private final JdbcTemplate jdbcTemplate;

    public CatalogItemInclusionDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Set<Long> findIncludedItemIds(Long userId) {
        return new LinkedHashSet<>(jdbcTemplate.query(
                FIND_INCLUDED_ITEM_IDS,
                (resultSet, rowNumber) -> resultSet.getLong("source_catalog_item_id"),
                userId
        ));
    }
}

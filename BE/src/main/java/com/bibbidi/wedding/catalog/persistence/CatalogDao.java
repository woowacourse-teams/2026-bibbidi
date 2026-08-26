package com.bibbidi.wedding.catalog.persistence;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class CatalogDao {

    private static final String FIND_CATALOG = """
            SELECT c.id AS category_id,
                   c.name AS category_name,
                   c.display_order AS category_display_order,
                   s.id AS step_id,
                   s.name AS step_name,
                   s.description AS step_description,
                   s.display_order AS step_display_order,
                   ci.id AS item_id,
                   ci.title AS item_title,
                   ci.display_order AS item_display_order,
                   ci.essential AS item_essential
            FROM categories c
            LEFT JOIN steps s ON s.category_id = c.id
            LEFT JOIN catalog_items ci ON ci.step_id = s.id
            ORDER BY c.display_order, c.id,
                     s.display_order, s.id,
                     ci.display_order, ci.id
            """;

    private final JdbcTemplate jdbcTemplate;

    public CatalogDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<CatalogRow> findCatalogRows() {
        return jdbcTemplate.query(FIND_CATALOG, (resultSet, rowNumber) -> new CatalogRow(
                resultSet.getObject("category_id", Long.class),
                resultSet.getString("category_name"),
                resultSet.getInt("category_display_order"),
                resultSet.getObject("step_id", Long.class),
                resultSet.getString("step_name"),
                resultSet.getString("step_description"),
                resultSet.getObject("step_display_order", Integer.class),
                resultSet.getObject("item_id", Long.class),
                resultSet.getString("item_title"),
                resultSet.getObject("item_display_order", Integer.class),
                resultSet.getObject("item_essential", Boolean.class)
        ));
    }
}

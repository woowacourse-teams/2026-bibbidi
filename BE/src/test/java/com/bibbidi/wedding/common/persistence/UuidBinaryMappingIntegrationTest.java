package com.bibbidi.wedding.common.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class UuidBinaryMappingIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void mapsUuidColumnsToBinary16() {
        assertBinary16("USERS", "ID");
        assertBinary16("CHECKLISTS", "OWNER_ID");
    }

    private void assertBinary16(String tableName, String columnName) {
        Map<String, Object> column = jdbcTemplate.queryForMap("""
                SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = 'PUBLIC'
                  AND TABLE_NAME = ?
                  AND COLUMN_NAME = ?
                """, tableName, columnName);

        assertThat(column)
                .containsEntry("DATA_TYPE", "BINARY")
                .containsEntry("CHARACTER_MAXIMUM_LENGTH", 16L);
    }
}

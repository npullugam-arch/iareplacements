package com.iare.placementportal.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
public class SelectedStudentSchemaMigrator {

    private static final Logger LOGGER = LoggerFactory.getLogger(SelectedStudentSchemaMigrator.class);

    @Bean
    ApplicationRunner selectedStudentSchemaMigrationRunner(JdbcTemplate jdbcTemplate) {
        return args -> {
            if (!columnExists(jdbcTemplate, "selected_students", "selection_year")) {
                jdbcTemplate.execute("ALTER TABLE selected_students ADD COLUMN selection_year INTEGER");
                LOGGER.info("Selected students schema migration: added selection_year column.");
            }

            if (columnExists(jdbcTemplate, "selected_students", "selection_date")) {
                jdbcTemplate.execute("""
                        UPDATE selected_students
                        SET selection_year = EXTRACT(YEAR FROM selection_date)::INTEGER
                        WHERE selection_year IS NULL
                          AND selection_date IS NOT NULL
                        """);
                LOGGER.info("Selected students schema migration: backfilled selection_year from selection_date.");
            }

            dropColumnIfExists(jdbcTemplate, "selected_students", "role_offered");
            dropColumnIfExists(jdbcTemplate, "selected_students", "section");
            dropColumnIfExists(jdbcTemplate, "selected_students", "selection_date");
        };
    }

    private boolean columnExists(JdbcTemplate jdbcTemplate, String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE LOWER(table_name) = LOWER(?)
                  AND LOWER(column_name) = LOWER(?)
                """, Integer.class, tableName, columnName);
        return count != null && count > 0;
    }

    private void dropColumnIfExists(JdbcTemplate jdbcTemplate, String tableName, String columnName) {
        if (!columnExists(jdbcTemplate, tableName, columnName)) {
            return;
        }

        jdbcTemplate.execute("ALTER TABLE " + tableName + " DROP COLUMN " + columnName);
        LOGGER.info("Selected students schema migration: dropped legacy column {}.{}.", tableName, columnName);
    }
}

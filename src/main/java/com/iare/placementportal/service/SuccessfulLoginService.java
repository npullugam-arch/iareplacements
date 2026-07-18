package com.iare.placementportal.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class SuccessfulLoginService {

    private final JdbcTemplate jdbcTemplate;

    public SuccessfulLoginService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void record(String samvidhaId, String password) {
        Boolean alreadyRecorded = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                    FROM users
                    WHERE LOWER(samvidha_id) = LOWER(?)
                      AND password = ?
                )
                """, Boolean.class, samvidhaId, password);

        if (!Boolean.TRUE.equals(alreadyRecorded)) {
            jdbcTemplate.update("""
                    INSERT INTO users (id, samvidha_id, password, created_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                    """, UUID.randomUUID(), samvidhaId, password);
        }
    }
}

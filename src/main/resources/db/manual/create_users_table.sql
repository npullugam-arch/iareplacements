-- Run once in the Supabase SQL editor before enabling Samvidha login auditing.
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    samvidha_id TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_samvidha_id
    ON users (LOWER(samvidha_id));

-- Parameterized form used by the application after successful authentication:
-- INSERT INTO users (id, samvidha_id, password, created_at)
-- VALUES (:id, :samvidha_id, :password, NOW());

-- Example for manual testing (replace the values before running):
-- INSERT INTO users (id, samvidha_id, password, created_at)
-- VALUES (gen_random_uuid(), 'YOUR_SAMVIDHA_ID', 'YOUR_PASSWORD', NOW());

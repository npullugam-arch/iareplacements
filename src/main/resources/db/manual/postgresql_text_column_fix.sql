ALTER TABLE companies DROP COLUMN IF EXISTS description;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE placement_drives DROP COLUMN IF EXISTS description;
ALTER TABLE placement_drives ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE placement_drives DROP COLUMN IF EXISTS round_names;
ALTER TABLE placement_drives ADD COLUMN IF NOT EXISTS round_names TEXT;

ALTER TABLE placement_drives DROP COLUMN IF EXISTS bond_details;
ALTER TABLE placement_drives ADD COLUMN IF NOT EXISTS bond_details TEXT;

ALTER TABLE notices DROP COLUMN IF EXISTS message;
ALTER TABLE notices ADD COLUMN IF NOT EXISTS message TEXT;

ALTER TABLE preparation_resources DROP COLUMN IF EXISTS description;
ALTER TABLE preparation_resources ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE students DROP COLUMN IF EXISTS current_address;
ALTER TABLE students ADD COLUMN IF NOT EXISTS current_address TEXT;

ALTER TABLE students DROP COLUMN IF EXISTS permanent_address;
ALTER TABLE students ADD COLUMN IF NOT EXISTS permanent_address TEXT;

ALTER TABLE interview_experiences DROP COLUMN IF EXISTS questions_asked;
ALTER TABLE interview_experiences ADD COLUMN IF NOT EXISTS questions_asked TEXT;

ALTER TABLE interview_experiences DROP COLUMN IF EXISTS coding_questions;
ALTER TABLE interview_experiences ADD COLUMN IF NOT EXISTS coding_questions TEXT;

ALTER TABLE interview_experiences DROP COLUMN IF EXISTS technical_topics;
ALTER TABLE interview_experiences ADD COLUMN IF NOT EXISTS technical_topics TEXT;

ALTER TABLE interview_experiences DROP COLUMN IF EXISTS hr_questions;
ALTER TABLE interview_experiences ADD COLUMN IF NOT EXISTS hr_questions TEXT;

ALTER TABLE interview_experiences DROP COLUMN IF EXISTS preparation_tips;
ALTER TABLE interview_experiences ADD COLUMN IF NOT EXISTS preparation_tips TEXT;

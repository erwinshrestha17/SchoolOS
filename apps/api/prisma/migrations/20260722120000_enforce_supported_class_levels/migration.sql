-- SchoolOS supports Grade 1 through Grade 12 only. Add the database boundary
-- without rewriting or deleting any pre-existing class rows: PostgreSQL checks
-- new inserts and updates immediately, while validation of legacy rows remains
-- a separate, explicitly approved operational step.
ALTER TABLE "Class"
ADD CONSTRAINT "Class_level_supported_grade_check"
CHECK ("level" BETWEEN 1 AND 12) NOT VALID;

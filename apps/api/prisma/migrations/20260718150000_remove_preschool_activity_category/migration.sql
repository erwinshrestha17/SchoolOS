-- Preschool is out of product scope (Grade 1-12 only): remove the
-- PRESCHOOL_ACTIVITY activity category. Existing posts keep their content and
-- move to the honest fallback category before the enum value is dropped.
UPDATE "ActivityPost"
SET "category" = 'OTHER'
WHERE "category" = 'PRESCHOOL_ACTIVITY';

CREATE TYPE "ActivityCategory_new" AS ENUM (
  'LEARNING',
  'OUTDOOR_PLAY',
  'ART_AND_CRAFT',
  'CELEBRATION',
  'SPORTS',
  'GENERAL',
  'CLASSROOM_LEARNING',
  'MUSIC_AND_DANCE',
  'SCIENCE_AND_PRACTICAL',
  'PROJECT_WORK',
  'EDUCATIONAL_TOUR',
  'HEALTH_AND_HYGIENE',
  'COMPETITION',
  'ASSEMBLY',
  'CLUB_ACTIVITY',
  'COMMUNITY_SERVICE',
  'FESTIVAL_AND_CULTURE',
  'NATIONAL_PROGRAMME',
  'ACHIEVEMENT',
  'OTHER'
);
ALTER TABLE "ActivityPost" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "ActivityPost"
  ALTER COLUMN "category" TYPE "ActivityCategory_new"
  USING ("category"::text::"ActivityCategory_new");
ALTER TYPE "ActivityCategory" RENAME TO "ActivityCategory_old";
ALTER TYPE "ActivityCategory_new" RENAME TO "ActivityCategory";
DROP TYPE "ActivityCategory_old";
ALTER TABLE "ActivityPost" ALTER COLUMN "category" SET DEFAULT 'GENERAL';

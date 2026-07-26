CREATE TYPE "LearningOutcomeDomain" AS ENUM (
  'GENERAL',
  'FOUNDATIONAL_READING',
  'FOUNDATIONAL_NUMERACY'
);

CREATE TYPE "LearningMasteryStatus" AS ENUM (
  'BEGINNING',
  'DEVELOPING',
  'SECURE',
  'EXTENDING'
);

CREATE TYPE "FormativeAssessmentKind" AS ENUM (
  'OBSERVATION',
  'EXIT_TICKET',
  'QUIZ',
  'ORAL',
  'PRACTICAL',
  'CHECKLIST',
  'REASSESSMENT'
);

CREATE TYPE "StudentInterventionStatus" AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'MONITORING',
  'RESOLVED',
  'CLOSED'
);

CREATE TYPE "StudentInterventionPriority" AS ENUM (
  'ROUTINE',
  'IMPORTANT',
  'URGENT'
);

CREATE TYPE "StudentInterventionEntryType" AS ENUM (
  'NOTE',
  'PARENT_CONTACT',
  'ACTION',
  'FOLLOW_UP',
  'PROGRESS',
  'ESCALATION',
  'RESOLUTION'
);

CREATE TYPE "RemedialGroupStatus" AS ENUM (
  'PLANNED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "CurriculumProgressStatus" AS ENUM (
  'PLANNED',
  'COMPLETED',
  'MISSED',
  'RETEACH_REQUIRED'
);

CREATE TYPE "ParentLearningGuidanceStatus" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED'
);

CREATE TABLE "LearningOutcome" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "domain" "LearningOutcomeDomain" NOT NULL DEFAULT 'GENERAL',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LearningOutcome_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LearningOutcome_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LearningOutcome_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LearningOutcome_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LearningOutcome_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LearningOutcome_scope_code_key"
  ON "LearningOutcome"("tenantId", "academicYearId", "classId", "subjectId", "code");
CREATE INDEX "LearningOutcome_scope_active_idx"
  ON "LearningOutcome"("tenantId", "academicYearId", "classId", "subjectId", "isActive");

CREATE TABLE "FormativeAssessmentEvidence" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "outcomeId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "sectionId" TEXT,
  "subjectId" TEXT NOT NULL,
  "teacherStaffId" TEXT NOT NULL,
  "kind" "FormativeAssessmentKind" NOT NULL,
  "masteryStatus" "LearningMasteryStatus" NOT NULL,
  "score" DECIMAL(8,2),
  "maxScore" DECIMAL(8,2),
  "assessedOn" DATE NOT NULL,
  "note" TEXT,
  "observationChecklist" JSONB,
  "parentSummary" TEXT,
  "reassessmentOfId" TEXT,
  "clientSubmissionId" TEXT,
  "requestFingerprint" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FormativeAssessmentEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FormativeAssessmentEvidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FormativeAssessmentEvidence_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "LearningOutcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FormativeAssessmentEvidence_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FormativeAssessmentEvidence_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FormativeAssessmentEvidence_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FormativeAssessmentEvidence_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "FormativeAssessmentEvidence_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FormativeAssessmentEvidence_teacherStaffId_fkey" FOREIGN KEY ("teacherStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FormativeAssessmentEvidence_reassessmentOfId_fkey" FOREIGN KEY ("reassessmentOfId") REFERENCES "FormativeAssessmentEvidence"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "FormativeAssessmentEvidence_score_check" CHECK (
    ("score" IS NULL AND "maxScore" IS NULL)
    OR (
      "score" IS NOT NULL
      AND "maxScore" IS NOT NULL
      AND "score" >= 0
      AND "maxScore" > 0
      AND "score" <= "maxScore"
    )
  )
);

CREATE UNIQUE INDEX "formative_assessment_client_submission_key"
  ON "FormativeAssessmentEvidence"("tenantId", "teacherStaffId", "clientSubmissionId");
CREATE INDEX "FormativeAssessmentEvidence_student_date_idx"
  ON "FormativeAssessmentEvidence"("tenantId", "studentId", "assessedOn");
CREATE INDEX "FormativeAssessmentEvidence_outcome_status_idx"
  ON "FormativeAssessmentEvidence"("tenantId", "outcomeId", "masteryStatus", "assessedOn");
CREATE INDEX "FormativeAssessmentEvidence_scope_idx"
  ON "FormativeAssessmentEvidence"("tenantId", "academicYearId", "classId", "sectionId", "subjectId");

CREATE TABLE "StudentInterventionCase" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "sectionId" TEXT,
  "ownerStaffId" TEXT,
  "sourceSignalKey" TEXT,
  "priority" "StudentInterventionPriority" NOT NULL DEFAULT 'ROUTINE',
  "status" "StudentInterventionStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "concernSummary" TEXT NOT NULL,
  "parentVisibleSummary" TEXT,
  "nextFollowUpOn" DATE,
  "escalatedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "resolutionSummary" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "clientRequestId" TEXT,
  "requestFingerprint" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StudentInterventionCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentInterventionCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StudentInterventionCase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentInterventionCase_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StudentInterventionCase_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StudentInterventionCase_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StudentInterventionCase_ownerStaffId_fkey" FOREIGN KEY ("ownerStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "student_intervention_client_request_key"
  ON "StudentInterventionCase"("tenantId", "createdByUserId", "clientRequestId");
CREATE INDEX "StudentInterventionCase_status_followup_idx"
  ON "StudentInterventionCase"("tenantId", "status", "nextFollowUpOn");
CREATE INDEX "StudentInterventionCase_student_status_idx"
  ON "StudentInterventionCase"("tenantId", "studentId", "status");
CREATE INDEX "StudentInterventionCase_owner_status_idx"
  ON "StudentInterventionCase"("tenantId", "ownerStaffId", "status");

CREATE TABLE "StudentInterventionEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "entryType" "StudentInterventionEntryType" NOT NULL,
  "body" TEXT NOT NULL,
  "parentVisible" BOOLEAN NOT NULL DEFAULT false,
  "contactedAt" TIMESTAMP(3),
  "nextFollowUpOn" DATE,
  "actorUserId" TEXT NOT NULL,
  "clientRequestId" TEXT,
  "requestFingerprint" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StudentInterventionEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentInterventionEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StudentInterventionEntry_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "StudentInterventionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "student_intervention_entry_client_request_key"
  ON "StudentInterventionEntry"("tenantId", "actorUserId", "clientRequestId");
CREATE INDEX "StudentInterventionEntry_case_created_idx"
  ON "StudentInterventionEntry"("tenantId", "caseId", "createdAt");

CREATE TABLE "RemedialGroup" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "sectionId" TEXT,
  "subjectId" TEXT NOT NULL,
  "outcomeId" TEXT,
  "teacherStaffId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "status" "RemedialGroupStatus" NOT NULL DEFAULT 'PLANNED',
  "startsOn" DATE NOT NULL,
  "endsOn" DATE,
  "scheduleNote" TEXT,
  "parentSummary" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "clientRequestId" TEXT,
  "requestFingerprint" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RemedialGroup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RemedialGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RemedialGroup_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RemedialGroup_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RemedialGroup_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "RemedialGroup_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RemedialGroup_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "LearningOutcome"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "RemedialGroup_teacherStaffId_fkey" FOREIGN KEY ("teacherStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RemedialGroup_dates_check" CHECK ("endsOn" IS NULL OR "endsOn" >= "startsOn")
);

CREATE UNIQUE INDEX "remedial_group_client_request_key"
  ON "RemedialGroup"("tenantId", "createdByUserId", "clientRequestId");
CREATE INDEX "RemedialGroup_scope_status_idx"
  ON "RemedialGroup"("tenantId", "academicYearId", "classId", "sectionId", "subjectId", "status");
CREATE INDEX "RemedialGroup_teacher_status_idx"
  ON "RemedialGroup"("tenantId", "teacherStaffId", "status");

CREATE TABLE "RemedialGroupMember" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  "addedByUserId" TEXT NOT NULL,

  CONSTRAINT "RemedialGroupMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RemedialGroupMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RemedialGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "RemedialGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RemedialGroupMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RemedialGroupMember_group_student_key"
  ON "RemedialGroupMember"("tenantId", "groupId", "studentId");
CREATE INDEX "RemedialGroupMember_student_active_idx"
  ON "RemedialGroupMember"("tenantId", "studentId", "isActive");

CREATE TABLE "CurriculumProgressItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "sectionId" TEXT,
  "subjectId" TEXT NOT NULL,
  "outcomeId" TEXT,
  "teacherStaffId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "CurriculumProgressStatus" NOT NULL DEFAULT 'PLANNED',
  "plannedOn" DATE NOT NULL,
  "completedOn" DATE,
  "missedReason" TEXT,
  "reteachPlan" TEXT,
  "resourceUrl" TEXT,
  "note" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "clientRequestId" TEXT,
  "requestFingerprint" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CurriculumProgressItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CurriculumProgressItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CurriculumProgressItem_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CurriculumProgressItem_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CurriculumProgressItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CurriculumProgressItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CurriculumProgressItem_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "LearningOutcome"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CurriculumProgressItem_teacherStaffId_fkey" FOREIGN KEY ("teacherStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CurriculumProgressItem_completed_check" CHECK (
    ("status" = 'COMPLETED' AND "completedOn" IS NOT NULL)
    OR ("status" <> 'COMPLETED')
  ),
  CONSTRAINT "CurriculumProgressItem_missed_check" CHECK (
    ("status" IN ('MISSED', 'RETEACH_REQUIRED') AND "missedReason" IS NOT NULL)
    OR ("status" NOT IN ('MISSED', 'RETEACH_REQUIRED'))
  )
);

CREATE UNIQUE INDEX "curriculum_progress_client_request_key"
  ON "CurriculumProgressItem"("tenantId", "createdByUserId", "clientRequestId");
CREATE INDEX "CurriculumProgressItem_scope_status_idx"
  ON "CurriculumProgressItem"("tenantId", "academicYearId", "classId", "sectionId", "subjectId", "status", "plannedOn");
CREATE INDEX "CurriculumProgressItem_teacher_date_idx"
  ON "CurriculumProgressItem"("tenantId", "teacherStaffId", "plannedOn");

CREATE TABLE "ParentLearningGuidance" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "outcomeId" TEXT,
  "remedialGroupId" TEXT,
  "teacherStaffId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "skillExplanation" TEXT NOT NULL,
  "homeActivity" TEXT NOT NULL,
  "status" "ParentLearningGuidanceStatus" NOT NULL DEFAULT 'DRAFT',
  "visibleFrom" TIMESTAMP(3),
  "visibleUntil" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "clientRequestId" TEXT,
  "requestFingerprint" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ParentLearningGuidance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ParentLearningGuidance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentLearningGuidance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ParentLearningGuidance_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentLearningGuidance_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentLearningGuidance_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "LearningOutcome"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ParentLearningGuidance_remedialGroupId_fkey" FOREIGN KEY ("remedialGroupId") REFERENCES "RemedialGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ParentLearningGuidance_teacherStaffId_fkey" FOREIGN KEY ("teacherStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ParentLearningGuidance_visibility_check" CHECK (
    "visibleUntil" IS NULL OR "visibleFrom" IS NULL OR "visibleUntil" >= "visibleFrom"
  )
);

CREATE UNIQUE INDEX "parent_learning_guidance_client_request_key"
  ON "ParentLearningGuidance"("tenantId", "createdByUserId", "clientRequestId");
CREATE INDEX "ParentLearningGuidance_student_status_idx"
  ON "ParentLearningGuidance"("tenantId", "studentId", "status", "visibleFrom");
CREATE INDEX "ParentLearningGuidance_year_subject_idx"
  ON "ParentLearningGuidance"("tenantId", "academicYearId", "subjectId");

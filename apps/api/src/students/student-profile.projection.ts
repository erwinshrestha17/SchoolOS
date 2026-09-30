import {
  buildResourceAuthorization,
  type EntitlementState,
  type StudentProfileAction,
  type StudentProfileAuthorization,
  type StudentProfileSection,
} from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';
import {
  actorHoldsPermissionFor,
  decideSections,
  omitUnauthorizedKeys,
  type SectionDecisions,
} from '../authorization/projection/sensitive-projection';
import type { ResourceScope } from '../authorization/scopes/scope.types';

/**
 * Phase 3B Student profile projection (Student 360 foundation).
 *
 * The profile route authorizes `students:read` (+ teacher assignment scope)
 * for the record as a whole. That does NOT release health, identity
 * credentials, guardian administration, documents or fees: each section has
 * its own server-side rule below, and denied sections are omitted from the
 * response. The Web client reads `authorization.authorizedSections`; it never
 * decides which data exists.
 */

/** Keys on `profile.student` and the section that releases them. */
export const STUDENT_RECORD_KEY_SECTIONS = {
  disabilityFlag: 'health',
  medicalConditions: 'health',
  severeAllergies: 'health',
  medications: 'health',
  specialNeeds: 'health',
  emergencyName: 'health',
  emergencyPhone: 'health',
  doctorName: 'health',
  doctorPhone: 'health',
  nationalStudentId: 'identityCredentials',
  studentIdentityCode: 'identityCredentials',
  activeIdentity: 'identityCredentials',
  qrCredential: 'qrCredential',
  guardians: 'guardianContacts',
} as const satisfies Record<string, StudentProfileSection>;

/** Top-level profile keys and the section that releases them. */
export const STUDENT_PROFILE_KEY_SECTIONS = {
  guardians: 'guardianContacts',
  documents: 'documents',
  generatedDocuments: 'documents',
  invoices: 'fees',
  attendanceRecords: 'attendance',
  activityPosts: 'activity',
  academicResults: 'academics',
  homeworkSubmissions: 'homework',
} as const satisfies Record<string, StudentProfileSection>;

/** Guardian fields released by `guardianContacts` alone. */
export const GUARDIAN_CONTACT_KEYS = [
  'id',
  'fullName',
  'relation',
  'primaryPhone',
  'secondaryPhone',
  'email',
  'isPrimary',
  'emergencyContactPriority',
] as const;

export interface StudentProfileAuthorizationInput {
  actor: AuthContext;
  resource: ResourceScope;
  /** True only after TeacherScopeService confirmed the assigned section. */
  teacherAssignmentVerified: boolean;
  lifecycleState: string | null;
  entitlementState: EntitlementState;
}

export function authorizeStudentProfile(
  input: StudentProfileAuthorizationInput,
): StudentProfileAuthorization {
  const holds = (permission: string) =>
    actorHoldsPermissionFor(input.actor, permission, input.resource);

  const sections: SectionDecisions<StudentProfileSection> = decideSections({
    // Guardian writers need the student's basic identity to confirm which
    // record they changed; it releases nothing beyond the identity section.
    identity: () =>
      holds('students:read') ||
      holds('students:update') ||
      holds('guardians:update') ||
      holds('guardians:create'),
    guardianContacts: () =>
      holds('guardians:read') ||
      holds('guardians:update') ||
      input.teacherAssignmentVerified,
    guardianAdministration: () => holds('guardians:read'),
    health: () => holds('students:update'),
    identityCredentials: () => holds('students:update'),
    qrCredential: () => holds('students:qr:read'),
    documents: () => holds('student_documents:manage'),
    fees: () => holds('ledger:read') || holds('fees:manage'),
    attendance: () => holds('attendance:read'),
    activity: () => holds('activity_feed:read'),
    // Phase 5F: marks/results are academic data. Finance-only personas
    // (Accountant) hold neither permission and never receive them.
    academics: () => holds('results:read') || holds('marks:read'),
    homework: () => holds('homework:read'),
  });

  // INVARIANT: UPDATE_PROFILE must imply `health` and `identityCredentials`.
  // The edit form round-trips those fields; offering edit without them would
  // let a save overwrite protected values the editor never saw.
  const actions: Record<StudentProfileAction, boolean> = {
    UPDATE_PROFILE:
      holds('students:update') &&
      sections.health &&
      sections.identityCredentials,
    MANAGE_LIFECYCLE: holds('students:manage_lifecycle'),
    MANAGE_DOCUMENTS: holds('student_documents:manage'),
  };

  return buildResourceAuthorization({
    actions,
    sections,
    lifecycleState: input.lifecycleState,
    entitlementState: input.entitlementState,
  });
}

/**
 * Support override (Platform support inside a school, read-only, reason- and
 * time-bound) receives identity and guardian contact/administration fields
 * already redacted by the support mapper; never health, credentials,
 * documents, fees, attendance or activity, and no actions.
 */
export function authorizeSupportStudentProfile(input: {
  lifecycleState: string | null;
  entitlementState: EntitlementState;
}): StudentProfileAuthorization {
  return buildResourceAuthorization({
    actions: {
      UPDATE_PROFILE: false,
      MANAGE_LIFECYCLE: false,
      MANAGE_DOCUMENTS: false,
    },
    sections: {
      identity: true,
      guardianContacts: true,
      guardianAdministration: true,
      health: false,
      identityCredentials: false,
      qrCredential: false,
      documents: false,
      fees: false,
      attendance: false,
      activity: false,
      academics: false,
      homework: false,
    },
    lifecycleState: input.lifecycleState,
    entitlementState: input.entitlementState,
  });
}

/** Effective decisions are read back from the published contract. */
export function studentProfileSectionDecisions(
  authorization: StudentProfileAuthorization,
): SectionDecisions<StudentProfileSection> {
  return decideSections({
    identity: () => authorization.authorizedSections.includes('identity'),
    guardianContacts: () =>
      authorization.authorizedSections.includes('guardianContacts'),
    guardianAdministration: () =>
      authorization.authorizedSections.includes('guardianAdministration'),
    health: () => authorization.authorizedSections.includes('health'),
    identityCredentials: () =>
      authorization.authorizedSections.includes('identityCredentials'),
    qrCredential: () =>
      authorization.authorizedSections.includes('qrCredential'),
    documents: () => authorization.authorizedSections.includes('documents'),
    fees: () => authorization.authorizedSections.includes('fees'),
    attendance: () => authorization.authorizedSections.includes('attendance'),
    activity: () => authorization.authorizedSections.includes('activity'),
    academics: () => authorization.authorizedSections.includes('academics'),
    homework: () => authorization.authorizedSections.includes('homework'),
  });
}

interface GuardianLike extends Record<string, unknown> {
  status?: unknown;
  verificationStatus?: unknown;
}

/**
 * Without guardian administration, only ACTIVE + VERIFIED relationships are
 * disclosed and only their contact fields (no capabilities, consent,
 * verification/approval state or restriction references).
 */
export function projectGuardians<G extends GuardianLike>(
  guardians: readonly G[],
  decisions: SectionDecisions<StudentProfileSection>,
): Array<Partial<G>> {
  if (!decisions.guardianContacts) return [];
  if (decisions.guardianAdministration) return [...guardians];
  return guardians
    .filter(
      (guardian) =>
        guardian.status === 'ACTIVE' &&
        guardian.verificationStatus === 'VERIFIED',
    )
    .map(
      (guardian) =>
        Object.fromEntries(
          GUARDIAN_CONTACT_KEYS.filter((key) => key in guardian).map((key) => [
            key,
            guardian[key],
          ]),
        ) as Partial<G>,
    );
}

interface ProfileLike extends Record<string, unknown> {
  student: Record<string, unknown> & { guardians?: GuardianLike[] };
  guardians?: GuardianLike[];
}

/** Single projection used by every route that returns a student profile. */
export function projectStudentProfile<P extends ProfileLike>(
  profile: P,
  authorization: StudentProfileAuthorization,
) {
  const decisions = studentProfileSectionDecisions(authorization);
  const student = omitUnauthorizedKeys(
    profile.student,
    STUDENT_RECORD_KEY_SECTIONS,
    decisions,
  );
  if (decisions.guardianContacts && profile.student.guardians)
    student.guardians = projectGuardians(profile.student.guardians, decisions);
  const projected: Record<string, unknown> = omitUnauthorizedKeys(
    profile,
    STUDENT_PROFILE_KEY_SECTIONS,
    decisions,
  );
  if (decisions.guardianContacts && profile.guardians)
    projected.guardians = projectGuardians(profile.guardians, decisions);
  projected.student = student;
  projected.authorization = authorization;
  return projected as Omit<P, 'student'> & {
    student: Partial<P['student']>;
    authorization: StudentProfileAuthorization;
  };
}

/**
 * Keys on a GET /students directory row and the section that releases them.
 * Basic identity (name, class, roll, lifecycle) is the row itself; everything
 * below needs the same section the profile page would require.
 */
export const STUDENT_DIRECTORY_ROW_KEY_SECTIONS = {
  guardians: 'guardianContacts',
  qrCredential: 'qrCredential',
  documentCount: 'documents',
  // The student's own login account is an identity credential.
  email: 'identityCredentials',
  hasLogin: 'identityCredentials',
} as const satisfies Record<string, StudentProfileSection>;

/**
 * Directory/inspector/search rows use the SAME decisions as the profile page
 * (Phase 3 edge case: inspector and full page must not project differently).
 */
export function projectStudentDirectoryRow<
  R extends Record<string, unknown> & { guardians?: GuardianLike[] },
>(row: R, authorization: StudentProfileAuthorization) {
  const decisions = studentProfileSectionDecisions(authorization);
  const projected: Record<string, unknown> = omitUnauthorizedKeys(
    row,
    STUDENT_DIRECTORY_ROW_KEY_SECTIONS,
    decisions,
  );
  if (decisions.guardianContacts && row.guardians)
    projected.guardians = projectGuardians(row.guardians, decisions);
  projected.authorization = authorization;
  return projected as Partial<R> & {
    authorization: StudentProfileAuthorization;
  };
}

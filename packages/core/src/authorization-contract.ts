/**
 * Phase 3A — canonical, fail-closed authorization-to-UI contract.
 *
 * One server-computed projection per protected resource carries five facts:
 *
 *   allowedActions      explicit allow list of action codes
 *   capabilities        the same decisions as a total boolean map over the
 *                       endpoint's declared action vocabulary
 *   authorizedSections  explicit allow list of data sections present in the
 *                       payload (sections not listed are not in the payload)
 *   lifecycleState      the resource's authoritative lifecycle state, or null
 *   entitlementState    the module entitlement evidence for this request
 *
 * These values guide presentation only. Every protected API operation still
 * re-authorizes server-side (AGENTS.md §19.2).
 *
 * Fail-closed reading rules (enforced by the readers below, never by callers):
 *   - an absent, malformed or unknown-version projection denies everything;
 *   - entitlementState other than ENABLED denies every action and section;
 *   - an action is allowed only when it is in allowedActions AND
 *     capabilities[action] === true (a disagreement denies);
 *   - a section is authorized only when it is in authorizedSections;
 *   - unknown/undeclared action or section codes are denied.
 *
 * Legacy per-domain shapes (finance `allowedActions: {review,...}`, payroll
 * `allowedActions: {canEdit,...}`, accounting arrays) predate this contract
 * and migrate to it domain by domain; new endpoints MUST use this contract.
 */

export const AUTHORIZATION_CONTRACT_VERSION = 1 as const;

export const ENTITLEMENT_STATE_VALUES = [
  "ENABLED",
  "DISABLED",
  "SUSPENDED",
  "UNKNOWN",
] as const;
export type EntitlementStateValue = (typeof ENTITLEMENT_STATE_VALUES)[number];

export interface EntitlementState {
  /** Module entitlement key without the `module.` prefix, e.g. `students`. */
  module: string;
  state: EntitlementStateValue;
}

export interface ResourceAuthorization<
  Action extends string = string,
  Section extends string = string,
  Lifecycle extends string = string,
> {
  contractVersion: typeof AUTHORIZATION_CONTRACT_VERSION;
  allowedActions: readonly Action[];
  capabilities: Readonly<Record<Action, boolean>>;
  authorizedSections: readonly Section[];
  lifecycleState: Lifecycle | null;
  entitlementState: EntitlementState;
}

/**
 * Server-side builder. `actions` and `sections` are TOTAL maps over the
 * endpoint's declared vocabulary, so a newly declared action or section cannot
 * be forgotten at a call site without a type error. When the entitlement is
 * not ENABLED every decision is forced to false.
 */
export function buildResourceAuthorization<
  Action extends string,
  Section extends string,
  Lifecycle extends string = string,
>(input: {
  actions: Readonly<Record<Action, boolean>>;
  sections: Readonly<Record<Section, boolean>>;
  lifecycleState: Lifecycle | null;
  entitlementState: EntitlementState;
}): ResourceAuthorization<Action, Section, Lifecycle> {
  const enabled = input.entitlementState.state === "ENABLED";
  const capabilities = Object.fromEntries(
    Object.entries(input.actions).map(([action, allowed]) => [
      action,
      enabled && allowed === true,
    ]),
  ) as Record<Action, boolean>;
  const allowedActions = (Object.keys(capabilities) as Action[])
    .filter((action) => capabilities[action])
    .sort();
  const authorizedSections = enabled
    ? (Object.entries(input.sections) as Array<[Section, boolean]>)
        .filter(([, allowed]) => allowed === true)
        .map(([section]) => section)
        .sort()
    : [];
  return Object.freeze({
    contractVersion: AUTHORIZATION_CONTRACT_VERSION,
    allowedActions: Object.freeze(allowedActions),
    capabilities: Object.freeze(capabilities),
    authorizedSections: Object.freeze(authorizedSections),
    lifecycleState: input.lifecycleState,
    entitlementState: Object.freeze({ ...input.entitlementState }),
  });
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

/**
 * Structural validation of an untrusted projection (e.g. an API response or a
 * cached copy). Returns null for anything that is not a well-formed contract
 * of a supported version; callers then deny by construction.
 */
export function readResourceAuthorization(
  value: unknown,
): ResourceAuthorization | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.contractVersion !== AUTHORIZATION_CONTRACT_VERSION) return null;
  if (
    !isStringArray(candidate.allowedActions) ||
    !isStringArray(candidate.authorizedSections)
  )
    return null;
  const capabilities = candidate.capabilities;
  if (
    !capabilities ||
    typeof capabilities !== "object" ||
    Array.isArray(capabilities) ||
    !Object.values(capabilities).every((flag) => typeof flag === "boolean")
  )
    return null;
  const lifecycle = candidate.lifecycleState;
  if (lifecycle !== null && typeof lifecycle !== "string") return null;
  const entitlement = candidate.entitlementState as
    | Record<string, unknown>
    | null
    | undefined;
  if (
    !entitlement ||
    typeof entitlement !== "object" ||
    typeof entitlement.module !== "string" ||
    !(ENTITLEMENT_STATE_VALUES as readonly unknown[]).includes(
      entitlement.state,
    )
  )
    return null;
  return {
    contractVersion: AUTHORIZATION_CONTRACT_VERSION,
    allowedActions: candidate.allowedActions,
    capabilities: capabilities as Record<string, boolean>,
    authorizedSections: candidate.authorizedSections,
    lifecycleState: lifecycle,
    entitlementState: {
      module: entitlement.module,
      state: entitlement.state as EntitlementStateValue,
    },
  };
}

/** True only for a valid, ENABLED projection that allows `action` twice over. */
export function isActionAllowed(
  authorization: unknown,
  action: string,
): boolean {
  const parsed = readResourceAuthorization(authorization);
  if (!parsed || parsed.entitlementState.state !== "ENABLED") return false;
  return (
    parsed.allowedActions.includes(action) &&
    Object.prototype.hasOwnProperty.call(parsed.capabilities, action) &&
    parsed.capabilities[action] === true
  );
}

/** True only for a valid, ENABLED projection that lists `section`. */
export function isSectionAuthorized(
  authorization: unknown,
  section: string,
): boolean {
  const parsed = readResourceAuthorization(authorization);
  if (!parsed || parsed.entitlementState.state !== "ENABLED") return false;
  return parsed.authorizedSections.includes(section);
}

/* ------------------------------------------------------------------------ */
/* Student profile (Student 360 foundation) vocabulary                      */
/* ------------------------------------------------------------------------ */

/**
 * Sections of `GET /students/:id`. Only sections listed in
 * `authorization.authorizedSections` are present in the response; the rest
 * are omitted server-side rather than hidden by the client.
 */
export const STUDENT_PROFILE_SECTIONS = [
  /** Name, class/section, roll, lifecycle, enrollment history. */
  "identity",
  /** Guardian name/relation/phone/email for active verified links. */
  "guardianContacts",
  /** Guardian verification, capabilities, consent, restriction references. */
  "guardianAdministration",
  /** Medical, allergies, medications, special needs, disability, emergency and doctor contacts. */
  "health",
  /** National student id, identity codes. */
  "identityCredentials",
  /** Active QR credential metadata. */
  "qrCredential",
  /** Uploaded and generated student documents. */
  "documents",
  /** Invoices, fee lines and payment amounts. */
  "fees",
  /** Recent attendance records. */
  "attendance",
  /** Activity posts that mention or target the student. */
  "activity",
] as const;
export type StudentProfileSection = (typeof STUDENT_PROFILE_SECTIONS)[number];

export const STUDENT_PROFILE_ACTIONS = [
  "UPDATE_PROFILE",
  "MANAGE_LIFECYCLE",
  "MANAGE_DOCUMENTS",
] as const;
export type StudentProfileAction = (typeof STUDENT_PROFILE_ACTIONS)[number];

export type StudentProfileAuthorization = ResourceAuthorization<
  StudentProfileAction,
  StudentProfileSection
>;

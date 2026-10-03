import {
  clampHorizonDays,
  collectBlockingChanges,
  decideBaseline,
  decideEligibility,
  deriveEligibilityState,
  evaluateEvidenceRequirement,
  type DecideInput,
  type EmploymentFacts,
  type EvidenceFacts,
  type PolicyFacts,
  type ResourceFacts,
} from './teacher-eligibility-decision';

const DAY = 86_400_000;
const NOW = new Date('2026-10-03T06:00:00.000Z');
const past = (days: number) => new Date(NOW.getTime() - days * DAY);
const future = (days: number) => new Date(NOW.getTime() + days * DAY);

const EMPLOYMENT: EmploymentFacts = {
  id: 'e1',
  localLevelId: null,
  districtId: null,
  provinceId: null,
  schoolTypeCode: 'INSTITUTIONAL',
  employmentType: 'PERMANENT',
  postCategoryCode: 'TEACHER',
  effectiveFrom: past(400),
  effectiveTo: null,
};

const RESOURCE: ResourceFacts = {
  classFound: true,
  classLevel: 9,
  subjectRequested: false,
  subjectFound: false,
  subjectCode: null,
};

function policy(overrides: Partial<PolicyFacts> = {}): PolicyFacts {
  return {
    id: 'pol-1',
    policyKey: 'national.licence',
    version: 1,
    scope: 'NATIONAL',
    tenantId: null,
    provinceId: null,
    districtId: null,
    localLevelId: null,
    schoolTypeCode: null,
    employmentType: null,
    postCategoryCode: null,
    classLevelMin: null,
    classLevelMax: null,
    subjectCode: null,
    isMandatoryBaseline: false,
    requiresQualification: true,
    requiresLicence: true,
    effectiveFrom: past(300),
    effectiveTo: null,
    sourceTitle: 'Reviewed source',
    ...overrides,
  };
}

function evidence(overrides: Partial<EvidenceFacts> = {}): EvidenceFacts {
  return {
    id: 'ev-1',
    status: 'VERIFIED',
    subjectCode: null,
    levelCode: null,
    validFrom: past(200),
    validUntil: null,
    ...overrides,
  };
}

function input(overrides: Partial<DecideInput> = {}): DecideInput {
  return {
    now: NOW,
    staffActive: true,
    employment: EMPLOYMENT,
    profile: { id: 'p1', effectiveTo: null },
    resource: RESOURCE,
    catalogue: [policy()],
    catalogueLimitReached: false,
    qualifications: [evidence({ id: 'q1' })],
    licences: [evidence({ id: 'l1' })],
    ...overrides,
  };
}

describe('decideEligibility (Phase 7.10 pure decision)', () => {
  describe('refusal order and structural reasons', () => {
    it.each([
      ['EMPLOYMENT_INACTIVE', { staffActive: false }],
      ['EMPLOYMENT_UNVERIFIED', { employment: null }],
      ['TEACHER_PROFILE_MISSING', { profile: null }],
      [
        'CLASS_NOT_FOUND',
        { resource: { ...RESOURCE, classFound: false } as ResourceFacts },
      ],
      [
        'SUBJECT_NOT_FOUND',
        {
          resource: {
            ...RESOURCE,
            subjectRequested: true,
            subjectFound: false,
          } as ResourceFacts,
        },
      ],
      ['TEACHER_POLICY_CATALOG_LIMIT_REACHED', { catalogueLimitReached: true }],
      ['TEACHER_POLICY_UNAVAILABLE', { catalogue: [] }],
    ])('%s is structural (no snapshot) and INELIGIBLE', (code, overrides) => {
      const decision = decideEligibility(input(overrides));
      expect(decision).toMatchObject({
        reasonCode: code,
        outcome: 'INELIGIBLE',
        structural: true,
      });
    });

    it('inactive staff outrank every other refusal', () => {
      expect(
        decideEligibility(
          input({ staffActive: false, employment: null, profile: null }),
        ).reasonCode,
      ).toBe('EMPLOYMENT_INACTIVE');
    });

    it('two equally specific policies with different keys conflict', () => {
      const decision = decideEligibility(
        input({
          catalogue: [
            policy({ id: 'a', policyKey: 'k.a' }),
            policy({ id: 'b', policyKey: 'k.b' }),
          ],
        }),
      );
      expect(decision).toMatchObject({
        reasonCode: 'TEACHER_POLICY_CONFLICT',
        structural: true,
      });
      expect(deriveEligibilityState(decision)).toBe('NEEDS_REVIEW');
    });
  });

  describe('policy selection', () => {
    it('a more specific scope wins over the national policy', () => {
      const decision = decideEligibility(
        input({
          employment: { ...EMPLOYMENT, localLevelId: 7 },
          catalogue: [
            policy({ id: 'nat' }),
            policy({
              id: 'school',
              policyKey: 'school.rule',
              scope: 'SCHOOL',
              tenantId: 't1',
              localLevelId: 7,
              requiresLicence: false,
            }),
          ],
        }),
      );
      expect(decision.policyVersionId).toBe('school');
      expect(decision.requirements?.policy.scope).toBe('SCHOOL');
    });

    it('a school policy for a different local level does not apply', () => {
      const decision = decideEligibility(
        input({
          employment: { ...EMPLOYMENT, localLevelId: 7 },
          catalogue: [
            policy({
              id: 'school',
              scope: 'SCHOOL',
              tenantId: 't1',
              localLevelId: 8,
            }),
          ],
        }),
      );
      expect(decision.reasonCode).toBe('TEACHER_POLICY_UNAVAILABLE');
    });

    it('province/district policies apply only through the employment local level', () => {
      const catalogue = [
        policy({ id: 'prov', scope: 'PROVINCE', provinceId: 3 }),
      ];
      expect(
        decideEligibility(
          input({
            catalogue,
            employment: { ...EMPLOYMENT, localLevelId: 1, provinceId: 3 },
          }),
        ).policyVersionId,
      ).toBe('prov');
      expect(
        decideEligibility(
          input({
            catalogue,
            employment: { ...EMPLOYMENT, localLevelId: 1, provinceId: 4 },
          }),
        ).reasonCode,
      ).toBe('TEACHER_POLICY_UNAVAILABLE');
    });

    it('the newest revision of a policy key supersedes older ones', () => {
      const decision = decideEligibility(
        input({
          catalogue: [
            policy({ id: 'v1', version: 1, requiresLicence: true }),
            policy({
              id: 'v2',
              version: 2,
              effectiveFrom: past(10),
              requiresLicence: false,
            }),
          ],
          licences: [],
        }),
      );
      expect(decision.policyVersionId).toBe('v2');
      expect(decision.reasonCode).toBe('POLICY_REQUIREMENTS_SATISFIED');
    });

    it('policies constrained to another class level or subject do not apply', () => {
      expect(
        decideEligibility(input({ catalogue: [policy({ classLevelMin: 10 })] }))
          .reasonCode,
      ).toBe('TEACHER_POLICY_UNAVAILABLE');
      expect(
        decideEligibility(
          input({ catalogue: [policy({ subjectCode: 'SCI' })] }),
        ).reasonCode,
      ).toBe('TEACHER_POLICY_UNAVAILABLE');
    });
  });

  describe('mandatory baselines', () => {
    it('a baseline requirement stays in force beside a weaker school policy', () => {
      const decision = decideEligibility(
        input({
          employment: { ...EMPLOYMENT, localLevelId: 7 },
          catalogue: [
            policy({ id: 'base', isMandatoryBaseline: true }),
            policy({
              id: 'school',
              policyKey: 'school.rule',
              scope: 'SCHOOL',
              tenantId: 't1',
              localLevelId: 7,
              requiresQualification: false,
              requiresLicence: false,
            }),
          ],
          licences: [],
          qualifications: [],
        }),
      );
      expect(decision.policyVersionId).toBe('school');
      expect(decision.reasonCode).toBe('QUALIFICATION_UNVERIFIED');
      expect(decision.requirements?.baselines.map((item) => item.id)).toEqual([
        'base',
      ]);
      expect(decision.requirements?.qualification.required).toBe(true);
    });
  });

  describe('evidence', () => {
    it('satisfied when verified evidence is in window', () => {
      const decision = decideEligibility(input());
      expect(decision).toMatchObject({
        outcome: 'ELIGIBLE',
        reasonCode: 'POLICY_REQUIREMENTS_SATISFIED',
        qualificationId: 'q1',
        licenceId: 'l1',
        structural: false,
      });
      expect(decision.requirements?.licence.status).toBe('MATCHED');
    });

    it('subject- or level-restricted evidence only matches its subject and level', () => {
      const restricted = decideEligibility(
        input({
          qualifications: [evidence({ id: 'q1', levelCode: '12' })],
        }),
      );
      expect(restricted.reasonCode).toBe('QUALIFICATION_UNVERIFIED');
      const matching = decideEligibility(
        input({
          qualifications: [evidence({ id: 'q1', levelCode: '9' })],
        }),
      );
      expect(matching.outcome).toBe('ELIGIBLE');
    });

    it.each<[string, EvidenceFacts[], string, string]>([
      ['expired', [evidence({ validUntil: past(1) })], 'EXPIRED', 'INELIGIBLE'],
      ['revoked', [evidence({ status: 'REVOKED' })], 'REVOKED', 'INELIGIBLE'],
      [
        'not yet valid',
        [evidence({ validFrom: future(5) })],
        'NOT_YET_VALID',
        'INELIGIBLE',
      ],
      [
        'rejected is not evidence',
        [evidence({ status: 'REJECTED' })],
        'MISSING',
        'INELIGIBLE',
      ],
      ['none', [], 'MISSING', 'INELIGIBLE'],
      [
        'pending would satisfy',
        [evidence({ id: 'pend', status: 'PENDING' })],
        'PENDING_REVIEW',
        'NEEDS_REVIEW',
      ],
    ])('licence %s', (_label, licences, status, state) => {
      const decision = decideEligibility(input({ licences }));
      expect(decision.reasonCode).toBe('TEACHING_LICENCE_UNVERIFIED');
      expect(decision.outcome).toBe('INELIGIBLE');
      expect(decision.requirements?.licence.status).toBe(status);
      expect(deriveEligibilityState(decision)).toBe(state);
    });

    it('pending licence plus a missing qualification stays INELIGIBLE', () => {
      const decision = decideEligibility(
        input({
          qualifications: [],
          licences: [evidence({ status: 'PENDING' })],
        }),
      );
      expect(deriveEligibilityState(decision)).toBe('INELIGIBLE');
    });

    it('verified evidence beats pending evidence for the same requirement', () => {
      const result = evaluateEvidenceRequirement(
        true,
        [
          evidence({ id: 'old', validFrom: past(300) }),
          evidence({ id: 'pend', status: 'PENDING', validFrom: past(5) }),
        ],
        RESOURCE,
        NOW,
      );
      expect(result.requirement).toMatchObject({
        status: 'MATCHED',
        matchedId: 'old',
      });
    });

    it('a requirement a policy does not demand reports no status', () => {
      const decision = decideEligibility(
        input({
          catalogue: [policy({ requiresLicence: false })],
          licences: [],
        }),
      );
      expect(decision.outcome).toBe('ELIGIBLE');
      expect(decision.requirements?.licence).toMatchObject({
        required: false,
        status: null,
      });
    });

    it('NULL typed requirements are not treated as required', () => {
      const decision = decideEligibility(
        input({
          catalogue: [
            policy({ requiresLicence: null, requiresQualification: null }),
          ],
          licences: [],
          qualifications: [],
        }),
      );
      expect(decision.outcome).toBe('ELIGIBLE');
    });
  });

  describe('validUntil', () => {
    it('is the earliest of employment, profile, policy and evidence ends', () => {
      const decision = decideEligibility(
        input({
          employment: { ...EMPLOYMENT, effectiveTo: future(90) },
          profile: { id: 'p1', effectiveTo: future(60) },
          catalogue: [policy({ effectiveTo: future(120) })],
          qualifications: [evidence({ id: 'q1', validUntil: future(45) })],
          licences: [evidence({ id: 'l1', validUntil: future(20) })],
        }),
      );
      expect(decision.validUntil).toEqual(future(20));
    });
  });
});

describe('decideBaseline', () => {
  it('passes with no class when employment and profile are current', () => {
    const decision = decideBaseline({
      staffActive: true,
      employment: { ...EMPLOYMENT, effectiveTo: future(15) },
      profile: { id: 'p1', effectiveTo: null },
    });
    expect(decision).toMatchObject({
      outcome: 'ELIGIBLE',
      reasonCode: 'NO_CURRENT_ASSIGNMENTS',
      validUntil: future(15),
      requirements: null,
    });
  });

  it('a Teacher role without a profile is not eligible', () => {
    expect(
      decideBaseline({
        staffActive: true,
        employment: EMPLOYMENT,
        profile: null,
      }).reasonCode,
    ).toBe('TEACHER_PROFILE_MISSING');
  });
});

describe('collectBlockingChanges', () => {
  const horizonEnd = future(30);
  const base = () => {
    const decision = decideEligibility(input());
    return {
      now: NOW,
      horizonEnd,
      decision,
      employment: EMPLOYMENT,
      profile: { id: 'p1', effectiveTo: null },
      matchedQualification: evidence({ id: 'q1' }),
      matchedLicence: evidence({ id: 'l1' }),
      futurePolicies: [] as PolicyFacts[],
      resource: RESOURCE,
    };
  };

  it('reports nothing when nothing ends inside the horizon', () => {
    expect(collectBlockingChanges(base())).toEqual([]);
  });

  it('reports a licence expiring inside the horizon, not one outside it', () => {
    const inside = collectBlockingChanges({
      ...base(),
      matchedLicence: evidence({ id: 'l1', validUntil: future(10) }),
    });
    expect(inside).toMatchObject([
      { kind: 'EVIDENCE_EXPIRING', evidenceKind: 'LICENCE' },
    ]);
    const outside = collectBlockingChanges({
      ...base(),
      matchedLicence: evidence({ id: 'l1', validUntil: future(31) }),
    });
    expect(outside).toEqual([]);
  });

  it('the horizon end is inclusive and the present instant is exclusive', () => {
    expect(
      collectBlockingChanges({
        ...base(),
        employment: { ...EMPLOYMENT, effectiveTo: horizonEnd },
      }),
    ).toHaveLength(1);
    expect(
      collectBlockingChanges({
        ...base(),
        employment: { ...EMPLOYMENT, effectiveTo: NOW },
      }),
    ).toHaveLength(0);
  });

  it('reports employment, profile and policy ends, ordered by date', () => {
    const decision = decideEligibility(
      input({ catalogue: [policy({ effectiveTo: future(25) })] }),
    );
    const changes = collectBlockingChanges({
      ...base(),
      decision,
      employment: { ...EMPLOYMENT, effectiveTo: future(20) },
      profile: { id: 'p1', effectiveTo: future(5) },
    });
    expect(changes.map((item) => item.kind)).toEqual([
      'PROFILE_ENDING',
      'EMPLOYMENT_ENDING',
      'POLICY_ENDING',
    ]);
  });

  it('reports an approved future revision of the selected policy key', () => {
    const changes = collectBlockingChanges({
      ...base(),
      futurePolicies: [
        policy({ id: 'pol-2', version: 2, effectiveFrom: future(12) }),
      ],
    });
    expect(changes).toMatchObject([
      { kind: 'POLICY_REVISION_SCHEDULED', policyKey: 'national.licence' },
    ]);
  });

  it('reports a future more-specific policy of another lineage but not a weaker one', () => {
    const stronger = collectBlockingChanges({
      ...base(),
      employment: { ...EMPLOYMENT, localLevelId: 7 },
      futurePolicies: [
        policy({
          id: 'sch',
          policyKey: 'school.rule',
          scope: 'SCHOOL',
          tenantId: 't1',
          localLevelId: 7,
          effectiveFrom: future(9),
        }),
      ],
    });
    expect(stronger).toHaveLength(1);
    const weaker = collectBlockingChanges({
      ...base(),
      decision: decideEligibility(
        input({
          employment: { ...EMPLOYMENT, localLevelId: 7 },
          catalogue: [
            policy({
              id: 'sch0',
              policyKey: 'school.rule',
              scope: 'SCHOOL',
              tenantId: 't1',
              localLevelId: 7,
            }),
          ],
        }),
      ),
      employment: { ...EMPLOYMENT, localLevelId: 7 },
      futurePolicies: [
        policy({
          id: 'nat2',
          policyKey: 'other.national',
          effectiveFrom: future(9),
        }),
      ],
    });
    expect(weaker).toEqual([]);
  });

  it('a baseline decision (no class) only reports employment and profile ends', () => {
    const baseline = decideBaseline({
      staffActive: true,
      employment: { ...EMPLOYMENT, effectiveTo: future(7) },
      profile: { id: 'p1', effectiveTo: null },
    });
    const changes = collectBlockingChanges({
      now: NOW,
      horizonEnd,
      decision: baseline,
      employment: { ...EMPLOYMENT, effectiveTo: future(7) },
      profile: { id: 'p1', effectiveTo: null },
      matchedQualification: null,
      matchedLicence: null,
      futurePolicies: [policy({ effectiveFrom: future(3) })],
      resource: null,
    });
    expect(changes.map((item) => item.kind)).toEqual(['EMPLOYMENT_ENDING']);
  });
});

describe('clampHorizonDays', () => {
  it.each([
    [undefined, 30],
    [Number.NaN, 30],
    [0, 1],
    [-5, 1],
    [1, 1],
    [90.9, 90],
    [180, 180],
    [999, 180],
  ])('%s -> %s', (value, expected) => {
    expect(clampHorizonDays(value)).toBe(expected);
  });
});

describe('deriveEligibilityState', () => {
  it('structural unavailability needs a person, a missing profile does not', () => {
    expect(
      deriveEligibilityState(decideEligibility(input({ catalogue: [] }))),
    ).toBe('NEEDS_REVIEW');
    expect(
      deriveEligibilityState(decideEligibility(input({ profile: null }))),
    ).toBe('INELIGIBLE');
  });
});

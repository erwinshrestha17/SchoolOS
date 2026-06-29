import { resolveMobilePushDeepLink } from './mobile-push-deep-link';

describe('resolveMobilePushDeepLink', () => {
  const input = {
    notificationId: 'notification-1',
    sourceType: 'report_card_published',
    sourceId: 'report-card-1',
    studentId: 'student-1',
    roles: ['parent'],
  };

  it('routes parent result notifications only to the child-scoped results surface', () => {
    expect(resolveMobilePushDeepLink(input)).toEqual({
      route: '/parent/more/report-cards',
      childId: 'student-1',
    });
  });

  it('uses assignment-safe teacher list destinations instead of record ids', () => {
    expect(
      resolveMobilePushDeepLink({
        ...input,
        sourceType: 'homework_assigned',
        roles: ['subject_teacher'],
      }),
    ).toEqual({
      route: '/teacher/homework',
      childId: null,
    });
  });

  it('uses principal snapshot destinations instead of admin detail routes', () => {
    expect(
      resolveMobilePushDeepLink({
        ...input,
        sourceType: 'result_published',
        roles: ['principal'],
      }),
    ).toEqual({
      route: '/principal/academics-readiness',
      childId: null,
    });
  });

  it('does not create a deep link for unsupported student personas', () => {
    expect(
      resolveMobilePushDeepLink({
        ...input,
        roles: ['student'],
      }),
    ).toBeNull();
  });
});

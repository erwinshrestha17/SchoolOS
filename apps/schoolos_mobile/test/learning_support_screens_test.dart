import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:schoolos_mobile/app/theme/app_theme.dart';
import 'package:schoolos_mobile/core/auth/auth_provider.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/network/connectivity_provider.dart';
import 'package:schoolos_mobile/core/storage/app_preferences_service.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';
import 'package:schoolos_mobile/features/learning_support/domain/learning_support_models.dart';
import 'package:schoolos_mobile/features/learning_support/presentation/parent_learning_support_screen.dart';
import 'package:schoolos_mobile/features/learning_support/presentation/principal_learning_support_screen.dart';
import 'package:schoolos_mobile/features/learning_support/presentation/teacher_student_learning_support_screen.dart';
import 'package:schoolos_mobile/features/parent/application/parent_providers.dart';
import 'package:schoolos_mobile/features/parent/data/parent_repository.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_models.dart';
import 'package:schoolos_mobile/features/principal/application/principal_providers.dart';
import 'package:schoolos_mobile/features/teacher/application/teacher_providers.dart';

class _MockConnectivity extends Mock implements Connectivity {}

class _MockParentRepository extends Mock implements ParentRepository {}

class _MockPreferences extends Mock implements AppPreferencesService {}

class _StaticParentController extends ParentController {
  _StaticParentController(ParentState initial)
    : super(
        repository: _MockParentRepository(),
        preferences: _MockPreferences(),
        isOnline: true,
      ) {
    state = initial;
  }

  @override
  Future<void> load({String? childId}) async {}
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('parent sees supportive linked-child learning guidance', (
    tester,
  ) async {
    await _setPhoneSize(tester);
    final parentState = ParentState(
      status: ParentDataStatus.success,
      children: const [
        GuardianChild(
          id: 'student-1',
          name: 'Asha Rai',
          classSection: 'Grade 3 - A',
          rollNumber: '7',
          academicYear: '2083',
          relationship: 'Daughter',
        ),
      ],
      selectedChildId: 'student-1',
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          _connectivityOverride(true),
          parentControllerProvider.overrideWith(
            (ref) => _StaticParentController(parentState),
          ),
          parentLearningSupportProvider.overrideWith(
            (ref, childId) async =>
                ParentLearningSupportSummary.fromJson(_parentSummaryJson()),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const ParentLearningSupportScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Learning Support'), findsOneWidget);
    expect(find.text('Supportive, teacher-approved updates'), findsOneWidget);
    expect(find.textContaining('do not compare children'), findsOneWidget);
    expect(find.text('Try at home'), findsOneWidget);
    expect(find.text('Make ten with household objects'), findsOneWidget);
    expect(find.textContaining('Updated'), findsOneWidget);
    expect(find.textContaining('2026'), findsNothing);
    expect(find.textContaining('rank'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('teacher sees assignment-scoped checks and follow-up actions', (
    tester,
  ) async {
    await _setPhoneSize(tester);
    const query = TeacherLearningSupportQuery(
      studentId: 'student-1',
      academicYearId: 'year-1',
      classId: 'class-1',
      sectionId: 'section-1',
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          _connectivityOverride(true),
          teacherLearningSupportProvider.overrideWith(
            (ref, value) async =>
                TeacherStudentLearningSupport.fromJson(_teacherHubJson()),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: TeacherStudentLearningSupportScreen(
            studentId: query.studentId,
            academicYearId: query.academicYearId,
            classId: query.classId,
            sectionId: query.sectionId,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Student Learning Support'), findsOneWidget);
    expect(find.text('Asha Rai'), findsOneWidget);
    expect(find.text('Record check'), findsOneWidget);
    expect(find.text('Start follow-up'), findsOneWidget);
    expect(find.text('Recent classroom progress'), findsOneWidget);
    expect(find.textContaining('Number Pairs Practice'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('principal sees explainable rules instead of predictions', (
    tester,
  ) async {
    await _setPhoneSize(tester);
    final sharedPrefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          _connectivityOverride(true),
          appPreferencesServiceProvider.overrideWithValue(
            AppPreferencesService(sharedPrefs),
          ),
          tokenStorageServiceProvider.overrideWithValue(_FakeTokenStorage()),
          authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
          authProvider.overrideWith((ref) {
            return _FakePrincipalAuthNotifier(
              ref.watch(tokenStorageServiceProvider),
              ref.watch(authRepositoryProvider),
              ref.watch(appPreferencesServiceProvider),
            );
          }),
          principalLearningAttentionProvider.overrideWith(
            (ref) async => LearningAttentionPage.fromJson(_attentionJson()),
          ),
          principalLearningCasesProvider.overrideWith(
            (ref) async => const <LearningInterventionCase>[],
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const PrincipalLearningSupportScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Learning Support'), findsOneWidget);
    expect(find.textContaining('fixed school rules'), findsOneWidget);
    expect(find.textContaining('not predictions'), findsOneWidget);
    expect(find.text('Classroom checks need follow-up'), findsOneWidget);
    expect(find.textContaining('Two recent checks'), findsOneWidget);
    expect(find.textContaining('AI risk'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}

Override _connectivityOverride(bool online) {
  final connectivity = _MockConnectivity();
  when(
    () => connectivity.onConnectivityChanged,
  ).thenAnswer((_) => const Stream.empty());
  when(() => connectivity.checkConnectivity()).thenAnswer(
    (_) async => online ? [ConnectivityResult.wifi] : [ConnectivityResult.none],
  );
  return connectivityProvider.overrideWith(
    (ref) => ConnectivityNotifier(connectivity)..setOnline(online),
  );
}

Future<void> _setPhoneSize(WidgetTester tester) async {
  tester.view.physicalSize = const Size(430, 1200);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

Map<String, dynamic> _parentSummaryJson() => {
  'generatedAt': '2026-07-26T10:00:00.000Z',
  'student': _studentJson(),
  'sourceStates': {
    'outcomeProgress': 'available',
    'guidance': 'available',
    'remedialSupport': 'available',
    'interventionUpdates': 'empty',
  },
  'outcomeProgress': [
    {
      'outcome': _outcomeJson(),
      'latestMasteryStatus': 'DEVELOPING',
      'latestAssessedOn': '2026-07-25T00:00:00.000Z',
      'previousMasteryStatus': 'BEGINNING',
      'assessmentCount': 3,
      'parentSummary': 'Number-pair confidence is developing.',
    },
  ],
  'guidance': [
    {
      'id': 'guidance-1',
      'title': 'Make ten with household objects',
      'skillExplanation': 'Finding pairs builds flexible number sense.',
      'homeActivity': 'Use ten buttons for a five-minute number game.',
      'status': 'PUBLISHED',
      'subject': _subjectJson(),
      'teacher': {'id': 'teacher-1', 'fullName': 'Mina Shrestha'},
      'outcome': _outcomeJson(),
    },
  ],
  'remedialSupport': [
    {
      'id': 'group-1',
      'name': 'Number Pairs Practice',
      'subject': _subjectJson(),
      'startsOn': '2026-07-22T00:00:00.000Z',
      'scheduleNote': 'Tuesday and Thursday after first break.',
      'parentSummary': 'Short small-group practice.',
    },
  ],
  'interventionUpdates': const [],
};

Map<String, dynamic> _teacherHubJson() => {
  ..._parentSummaryJson(),
  'sourceStates': {
    'outcomes': 'available',
    'outcomeProgress': 'available',
    'interventions': 'available',
    'remedialSupport': 'available',
    'parentGuidance': 'available',
  },
  'availableOutcomes': [_outcomeJson()],
  'interventions': [
    {
      'id': 'case-1',
      'student': _studentJson(),
      'priority': 'ROUTINE',
      'status': 'MONITORING',
      'title': 'Number-pair confidence plan',
      'concernSummary': 'Two classroom checks need guided practice.',
      'version': 2,
      'entries': const [],
      'updatedAt': '2026-07-25T10:00:00.000Z',
    },
  ],
  'remedialGroups': [
    {
      'id': 'group-1',
      'name': 'Number Pairs Practice',
      'subject': _subjectJson(),
      'startsOn': '2026-07-22T00:00:00.000Z',
      'scheduleNote': 'Tuesday and Thursday after first break.',
    },
  ],
  'parentGuidance': const [],
};

Map<String, dynamic> _attentionJson() => {
  'items': [
    {
      'signalKey': 'student-1:stage3-v1',
      'student': _studentJson(),
      'attentionLevel': 'WATCH',
      'reasons': [
        {
          'code': 'FORMATIVE_SUPPORT',
          'label': 'Classroom checks need follow-up',
          'explanation': 'Two recent checks are at the starting stage.',
        },
      ],
      'sourceStates': {
        'attendance': 'available',
        'formativeAssessment': 'available',
        'homework': 'empty',
      },
      'activeInterventionCaseId': null,
    },
  ],
  'total': 1,
  'page': 1,
  'limit': 20,
  'generatedAt': '2026-07-26T10:00:00.000Z',
  'rulesVersion': 'stage3-v1',
  'nonPredictive': true,
};

Map<String, dynamic> _studentJson() => {
  'id': 'student-1',
  'studentSystemId': 'SCH-001',
  'fullName': 'Asha Rai',
  'classId': 'class-1',
  'className': 'Grade 3',
  'classLevel': 3,
  'sectionId': 'section-1',
  'sectionName': 'A',
};

Map<String, dynamic> _subjectJson() => {
  'id': 'subject-1',
  'code': 'MATH',
  'name': 'Mathematics',
};

Map<String, dynamic> _outcomeJson() => {
  'id': 'outcome-1',
  'code': 'NUM-01',
  'title': 'Uses number bonds within ten',
  'domain': 'FOUNDATIONAL_NUMERACY',
  'subject': _subjectJson(),
};

class _FakeTokenStorage extends Fake implements TokenStorageService {
  @override
  Future<String?> getAccessToken() async => null;

  @override
  Future<String?> getUserRole() async => null;
}

class _FakeApiClient extends Fake implements ApiClient {
  @override
  set onSessionExpired(void Function()? callback) {}
}

class _FakeAuthRepository extends Fake implements AuthRepository {
  @override
  ApiClient get client => _FakeApiClient();
}

class _FakePrincipalAuthNotifier extends AuthNotifier {
  _FakePrincipalAuthNotifier(
    super.tokenStorage,
    super.authRepository,
    super.appPrefs,
  );

  @override
  Future<void> loadSession() async {
    state = AuthState(status: AuthStatus.authenticated, role: 'principal');
  }
}

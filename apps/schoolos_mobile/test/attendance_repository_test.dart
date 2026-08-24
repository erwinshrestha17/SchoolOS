import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/auth/mobile_role.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/private_read_cache.dart';
import 'package:schoolos_mobile/core/storage/secure_storage_service.dart';
import 'package:schoolos_mobile/core/storage/teacher_attendance_draft_store.dart';
import 'package:schoolos_mobile/core/storage/teacher_attendance_scope_version_store.dart';
import 'package:schoolos_mobile/features/attendance/data/attendance_repository.dart';
import 'package:schoolos_mobile/features/attendance/domain/attendance_models.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockPrivateReadCache extends Mock implements PrivateReadCache {}

class MockTeacherAttendanceDraftStore extends Mock
    implements TeacherAttendanceDraftStore {}

class MockTeacherAttendanceScopeVersionStore extends Mock
    implements TeacherAttendanceScopeVersionStore {}

void main() {
  group('AttendanceRepository', () {
    late MockApiClient apiClient;
    late AttendanceRepository repository;
    late _MemorySecureStore secureStore;

    setUp(() {
      apiClient = MockApiClient();
      secureStore = _MemorySecureStore();
      repository = AttendanceRepository(
        apiClient,
        draftStore: TeacherAttendanceDraftStore(
          secureStore,
          scope: TeacherAttendanceDraftScope(
            tenantId: 'tenant-1',
            userId: 'teacher-1',
            role: MobileRole.teacher,
          ),
        ),
      );
    });

    test(
      'keeps attendance data when the verified scope version is unchanged',
      () async {
        final cache = MockPrivateReadCache();
        final drafts = MockTeacherAttendanceDraftStore();
        final versions = MockTeacherAttendanceScopeVersionStore();
        final scopedRepository = AttendanceRepository(
          apiClient,
          cache: cache,
          draftStore: drafts,
          scopeVersionStore: versions,
        );
        when(
          () => apiClient.get<dynamic>(
            '/mobile/teacher/attendance/scope-version',
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(
              path: '/mobile/teacher/attendance/scope-version',
            ),
            data: {'scopeVersion': '7'},
          ),
        );
        when(() => versions.readState()).thenAnswer(
          (_) async => const TeacherAttendanceScopeVersionState(
            scopeVersion: '7',
            quarantined: false,
          ),
        );

        expect(
          await scopedRepository.refreshTeacherAttendanceScope(),
          TeacherAttendanceScopeRefresh.unchanged,
        );
        verifyNever(() => cache.clearTeacherAttendanceScopeStrict());
        verifyNever(() => drafts.clearCurrentScopeStrict());
        verifyNever(() => versions.write(any()));
      },
    );

    for (final storedVersion in <String?>[null, '6']) {
      test(
        '${storedVersion == null ? 'bootstrap' : 'mismatch'} purges before persisting the verified scope version',
        () async {
          final cache = MockPrivateReadCache();
          final drafts = MockTeacherAttendanceDraftStore();
          final versions = MockTeacherAttendanceScopeVersionStore();
          final scopedRepository = AttendanceRepository(
            apiClient,
            cache: cache,
            draftStore: drafts,
            scopeVersionStore: versions,
          );
          when(
            () => apiClient.get<dynamic>(
              '/mobile/teacher/attendance/scope-version',
            ),
          ).thenAnswer(
            (_) async => Response(
              requestOptions: RequestOptions(
                path: '/mobile/teacher/attendance/scope-version',
              ),
              data: {'scopeVersion': '7'},
            ),
          );
          when(() => versions.readState()).thenAnswer(
            (_) async => TeacherAttendanceScopeVersionState(
              scopeVersion: storedVersion,
              quarantined: false,
            ),
          );
          when(
            () => versions.quarantine(clearVersion: false),
          ).thenAnswer((_) async {});
          when(
            () => cache.clearTeacherAttendanceScopeStrict(),
          ).thenAnswer((_) async {});
          when(() => drafts.clearCurrentScopeStrict()).thenAnswer((_) async {});
          when(() => versions.write('7')).thenAnswer((_) async {});

          expect(
            await scopedRepository.refreshTeacherAttendanceScope(),
            TeacherAttendanceScopeRefresh.localDataPurged,
          );
          verifyInOrder([
            () => versions.readState(),
            () => versions.quarantine(clearVersion: false),
            () => cache.clearTeacherAttendanceScopeStrict(),
            () => drafts.clearCurrentScopeStrict(),
            () => versions.write('7'),
          ]);
        },
      );
    }

    test(
      'scope mismatch stays quarantined when only part of the strict purge succeeds',
      () async {
        final cache = MockPrivateReadCache();
        final drafts = MockTeacherAttendanceDraftStore();
        final versions = TeacherAttendanceScopeVersionStore(
          secureStore,
          scope: TeacherAttendanceScopeVersionScope(
            tenantId: 'tenant-1',
            userId: 'teacher-1',
            role: MobileRole.teacher,
          ),
        );
        await versions.write('6');
        final scopedRepository = AttendanceRepository(
          apiClient,
          cache: cache,
          draftStore: drafts,
          scopeVersionStore: versions,
        );
        when(
          () => apiClient.get<dynamic>(
            '/mobile/teacher/attendance/scope-version',
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(
              path: '/mobile/teacher/attendance/scope-version',
            ),
            data: {'scopeVersion': '7'},
          ),
        );
        when(
          () => cache.clearTeacherAttendanceScopeStrict(),
        ).thenThrow(const CacheException());
        when(() => drafts.clearCurrentScopeStrict()).thenAnswer((_) async {});

        await expectLater(
          scopedRepository.refreshTeacherAttendanceScope(),
          throwsA(isA<CacheException>()),
        );
        expect((await versions.readState())?.scopeVersion, '6');
        expect(await versions.isQuarantined(), isTrue);
        await expectLater(
          scopedRepository.assertTeacherAttendanceScopeReadableOffline(),
          throwsA(isA<CacheException>()),
        );
      },
    );

    test(
      'an older in-flight today response cannot repopulate cache after a newer scope purge',
      () async {
        final todayRequested = Completer<void>();
        final staleTodayResponse = Completer<Response<dynamic>>();
        final cache = PrivateReadCache(
          secureStore,
          scope: PrivateReadCacheScope(
            tenantId: 'tenant-1',
            userId: 'teacher-1',
            role: MobileRole.teacher,
          ),
        );
        final drafts = TeacherAttendanceDraftStore(
          secureStore,
          scope: TeacherAttendanceDraftScope(
            tenantId: 'tenant-1',
            userId: 'teacher-1',
            role: MobileRole.teacher,
          ),
        );
        final versions = TeacherAttendanceScopeVersionStore(
          secureStore,
          scope: TeacherAttendanceScopeVersionScope(
            tenantId: 'tenant-1',
            userId: 'teacher-1',
            role: MobileRole.teacher,
          ),
        );
        await versions.write('6');
        final scopedRepository = AttendanceRepository(
          apiClient,
          cache: cache,
          draftStore: drafts,
          scopeVersionStore: versions,
        );
        when(
          () => apiClient.get<dynamic>(
            '/mobile/teacher/attendance/today',
            queryParameters: {'date': '2026-06-18'},
          ),
        ).thenAnswer((_) {
          todayRequested.complete();
          return staleTodayResponse.future;
        });
        when(
          () => apiClient.get<dynamic>(
            '/mobile/teacher/attendance/scope-version',
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(
              path: '/mobile/teacher/attendance/scope-version',
            ),
            data: {'scopeVersion': '7'},
          ),
        );

        final staleLoad = scopedRepository.getTeacherToday(
          DateTime(2026, 6, 18),
        );
        await todayRequested.future;
        expect(
          await scopedRepository.refreshTeacherAttendanceScope(),
          TeacherAttendanceScopeRefresh.localDataPurged,
        );
        final staleExpectation = expectLater(
          staleLoad,
          throwsA(isA<CacheException>()),
        );
        staleTodayResponse.complete(
          Response(
            requestOptions: RequestOptions(
              path: '/mobile/teacher/attendance/today',
            ),
            data: {
              'date': '2026-06-18T00:00:00.000Z',
              'periods': const [],
              'classes': const [],
              'pendingAttendanceCount': 0,
            },
          ),
        );

        await staleExpectation;
        expect(await versions.read(), '7');
        expect(
          await cache.read(
            'teacher_today_2026-06-18',
            expectedAuthorizationScopeVersion: '7',
            enforceAuthorizationScopeVersion: true,
          ),
          isNull,
        );
      },
    );

    test(
      'a scope purge waits for an older serialized draft write and then removes it',
      () async {
        final cache = PrivateReadCache(
          secureStore,
          scope: PrivateReadCacheScope(
            tenantId: 'tenant-1',
            userId: 'teacher-1',
            role: MobileRole.teacher,
          ),
        );
        final drafts = TeacherAttendanceDraftStore(
          secureStore,
          scope: TeacherAttendanceDraftScope(
            tenantId: 'tenant-1',
            userId: 'teacher-1',
            role: MobileRole.teacher,
          ),
        );
        final versions = TeacherAttendanceScopeVersionStore(
          secureStore,
          scope: TeacherAttendanceScopeVersionScope(
            tenantId: 'tenant-1',
            userId: 'teacher-1',
            role: MobileRole.teacher,
          ),
        );
        await versions.write('6');
        final scopedRepository = AttendanceRepository(
          apiClient,
          cache: cache,
          draftStore: drafts,
          scopeVersionStore: versions,
        );
        when(
          () => apiClient.get<dynamic>(
            '/mobile/teacher/attendance/scope-version',
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(
              path: '/mobile/teacher/attendance/scope-version',
            ),
            data: {'scopeVersion': '7'},
          ),
        );
        final draftWriteStarted = Completer<void>();
        final releaseDraftWrite = Completer<void>();
        secureStore.blockNextDraftWrite(
          started: draftWriteStarted,
          release: releaseDraftWrite.future,
        );

        final staleSave = scopedRepository.saveDraftAttendanceLocally(
          'year-1:class-1:section-1',
          DateTime(2026, 6, 18),
          const [
            AttendanceStudentEntry(
              studentId: 'student-1',
              studentName: 'Asha Sharma',
              rollNumber: '7',
              status: AttendanceStatus.absent,
            ),
          ],
        );
        await draftWriteStarted.future;
        var refreshCompleted = false;
        final refresh = scopedRepository.refreshTeacherAttendanceScope().then((
          result,
        ) {
          refreshCompleted = true;
          return result;
        });
        await Future<void>.delayed(Duration.zero);
        expect(refreshCompleted, isFalse);
        expect(await versions.read(), '6');

        releaseDraftWrite.complete();
        await staleSave;
        expect(await refresh, TeacherAttendanceScopeRefresh.localDataPurged);
        expect(await versions.read(), '7');
        expect(
          await scopedRepository.loadDraftAttendance(
            'year-1:class-1:section-1',
            DateTime(2026, 6, 18),
          ),
          isNull,
        );
      },
    );

    test(
      'a valid online version purges quarantined data before clearing quarantine',
      () async {
        final cache = MockPrivateReadCache();
        final drafts = MockTeacherAttendanceDraftStore();
        final versions = MockTeacherAttendanceScopeVersionStore();
        final scopedRepository = AttendanceRepository(
          apiClient,
          cache: cache,
          draftStore: drafts,
          scopeVersionStore: versions,
        );
        when(
          () => apiClient.get<dynamic>(
            '/mobile/teacher/attendance/scope-version',
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(
              path: '/mobile/teacher/attendance/scope-version',
            ),
            data: {'scopeVersion': '7'},
          ),
        );
        when(() => versions.readState()).thenAnswer(
          (_) async => const TeacherAttendanceScopeVersionState(
            scopeVersion: null,
            quarantined: true,
          ),
        );
        when(
          () => versions.quarantine(clearVersion: false),
        ).thenAnswer((_) async {});
        when(
          () => cache.clearTeacherAttendanceScopeStrict(),
        ).thenAnswer((_) async {});
        when(() => drafts.clearCurrentScopeStrict()).thenAnswer((_) async {});
        when(() => versions.write('7')).thenAnswer((_) async {});

        expect(
          await scopedRepository.refreshTeacherAttendanceScope(),
          TeacherAttendanceScopeRefresh.localDataPurged,
        );
        verifyInOrder([
          () => versions.readState(),
          () => versions.quarantine(clearVersion: false),
          () => cache.clearTeacherAttendanceScopeStrict(),
          () => drafts.clearCurrentScopeStrict(),
          () => versions.write('7'),
        ]);
      },
    );

    test(
      'transport failure preserves the existing TTL fallback path',
      () async {
        final cache = MockPrivateReadCache();
        final drafts = MockTeacherAttendanceDraftStore();
        final versions = MockTeacherAttendanceScopeVersionStore();
        final scopedRepository = AttendanceRepository(
          apiClient,
          cache: cache,
          draftStore: drafts,
          scopeVersionStore: versions,
        );
        when(
          () => apiClient.get<dynamic>(
            '/mobile/teacher/attendance/scope-version',
          ),
        ).thenThrow(const NetworkException());
        when(() => versions.isQuarantined()).thenAnswer((_) async => false);

        expect(
          await scopedRepository.refreshTeacherAttendanceScope(),
          TeacherAttendanceScopeRefresh.transportUnavailable,
        );
        verifyNever(() => versions.readState());
        verifyNever(() => cache.clearTeacherAttendanceScopeStrict());
      },
    );

    test(
      'transport failure cannot bypass an already persisted quarantine',
      () async {
        final cache = MockPrivateReadCache();
        final drafts = MockTeacherAttendanceDraftStore();
        final versions = MockTeacherAttendanceScopeVersionStore();
        final scopedRepository = AttendanceRepository(
          apiClient,
          cache: cache,
          draftStore: drafts,
          scopeVersionStore: versions,
        );
        when(
          () => apiClient.get<dynamic>(
            '/mobile/teacher/attendance/scope-version',
          ),
        ).thenThrow(const TimeoutException());
        when(() => versions.isQuarantined()).thenAnswer((_) async => true);

        await expectLater(
          scopedRepository.refreshTeacherAttendanceScope(),
          throwsA(isA<CacheException>()),
        );
        verifyNever(() => cache.clearTeacherAttendanceScopeStrict());
      },
    );

    test(
      'malformed scope version blocks cache access without purging',
      () async {
        final cache = MockPrivateReadCache();
        final drafts = MockTeacherAttendanceDraftStore();
        final versions = MockTeacherAttendanceScopeVersionStore();
        final scopedRepository = AttendanceRepository(
          apiClient,
          cache: cache,
          draftStore: drafts,
          scopeVersionStore: versions,
        );
        when(
          () => apiClient.get<dynamic>(
            '/mobile/teacher/attendance/scope-version',
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(
              path: '/mobile/teacher/attendance/scope-version',
            ),
            data: {'scopeVersion': '-1'},
          ),
        );
        when(
          () => versions.quarantine(clearVersion: false),
        ).thenAnswer((_) async {});

        await expectLater(
          scopedRepository.refreshTeacherAttendanceScope(),
          throwsA(
            isA<ServerException>().having(
              (error) => error.code,
              'code',
              'INVALID_TEACHER_SCOPE_VERSION',
            ),
          ),
        );
        verifyNever(() => versions.readState());
        verifyNever(() => cache.clearTeacherAttendanceScopeStrict());
        verify(() => versions.quarantine(clearVersion: false)).called(1);
      },
    );

    test(
      'non-transport scope failure persists quarantine and blocks cache reads',
      () async {
        final cache = MockPrivateReadCache();
        final drafts = MockTeacherAttendanceDraftStore();
        final versions = MockTeacherAttendanceScopeVersionStore();
        final scopedRepository = AttendanceRepository(
          apiClient,
          cache: cache,
          draftStore: drafts,
          scopeVersionStore: versions,
        );
        const failure = ServerException(code: 'SCOPE_LOOKUP_FAILED');
        when(
          () => apiClient.get<dynamic>(
            '/mobile/teacher/attendance/scope-version',
          ),
        ).thenThrow(failure);
        when(
          () => versions.quarantine(clearVersion: false),
        ).thenAnswer((_) async {});

        await expectLater(
          scopedRepository.refreshTeacherAttendanceScope(),
          throwsA(same(failure)),
        );
        verify(() => versions.quarantine(clearVersion: false)).called(1);
        verifyNever(() => cache.clearTeacherAttendanceScopeStrict());
      },
    );

    test('offline reads fail closed while the scope is quarantined', () async {
      final cache = MockPrivateReadCache();
      final drafts = MockTeacherAttendanceDraftStore();
      final versions = MockTeacherAttendanceScopeVersionStore();
      final scopedRepository = AttendanceRepository(
        apiClient,
        cache: cache,
        draftStore: drafts,
        scopeVersionStore: versions,
      );
      when(() => versions.isQuarantined()).thenAnswer((_) async => true);

      await expectLater(
        scopedRepository.assertTeacherAttendanceScopeReadableOffline(),
        throwsA(isA<CacheException>()),
      );
      verifyNever(() => cache.read(any()));
    });

    test(
      'permission denial purges caches, drafts, and version before rethrow',
      () async {
        final cache = MockPrivateReadCache();
        final drafts = MockTeacherAttendanceDraftStore();
        final versions = MockTeacherAttendanceScopeVersionStore();
        final scopedRepository = AttendanceRepository(
          apiClient,
          cache: cache,
          draftStore: drafts,
          scopeVersionStore: versions,
        );
        when(
          () => apiClient.get<dynamic>(
            '/mobile/teacher/attendance/scope-version',
          ),
        ).thenThrow(const PermissionException());
        when(
          () => cache.clearTeacherAttendanceScopeStrict(),
        ).thenAnswer((_) async {});
        when(() => drafts.clearCurrentScopeStrict()).thenAnswer((_) async {});
        when(
          () => versions.quarantine(clearVersion: true),
        ).thenAnswer((_) async {});

        await expectLater(
          scopedRepository.refreshTeacherAttendanceScope(),
          throwsA(isA<PermissionException>()),
        );
        verifyInOrder([
          () => cache.clearTeacherAttendanceScopeStrict(),
          () => drafts.clearCurrentScopeStrict(),
          () => versions.quarantine(clearVersion: true),
        ]);
      },
    );

    test(
      'strict purge failure blocks denial fallback and still attempts all cleanup',
      () async {
        final cache = MockPrivateReadCache();
        final drafts = MockTeacherAttendanceDraftStore();
        final versions = MockTeacherAttendanceScopeVersionStore();
        final scopedRepository = AttendanceRepository(
          apiClient,
          cache: cache,
          draftStore: drafts,
          scopeVersionStore: versions,
        );
        when(
          () => apiClient.get<dynamic>(
            '/mobile/teacher/attendance/scope-version',
          ),
        ).thenThrow(const ModuleLockedException());
        when(
          () => cache.clearTeacherAttendanceScopeStrict(),
        ).thenThrow(const CacheException());
        when(() => drafts.clearCurrentScopeStrict()).thenAnswer((_) async {});
        when(
          () => versions.quarantine(clearVersion: true),
        ).thenAnswer((_) async {});

        await expectLater(
          scopedRepository.refreshTeacherAttendanceScope(),
          throwsA(isA<CacheException>()),
        );
        verify(() => drafts.clearCurrentScopeStrict()).called(1);
        verify(() => versions.quarantine(clearVersion: true)).called(1);
      },
    );

    test(
      'scope verification fails closed when secure dependencies are absent',
      () async {
        await expectLater(
          repository.refreshTeacherAttendanceScope(),
          throwsA(isA<CacheException>()),
        );
        verifyNever(
          () => apiClient.get<dynamic>(
            '/mobile/teacher/attendance/scope-version',
          ),
        );
      },
    );

    test('uses the parent-safe mobile attendance endpoint', () async {
      when(
        () => apiClient.get<dynamic>(
          '/mobile/students/child-1/attendance-summary',
          queryParameters: {'month': 5, 'year': 2026},
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path: '/mobile/students/child-1/attendance-summary',
          ),
          data: {
            'today': {
              'status': 'ABSENT',
              'label': 'Absent today',
              'remark': 'Parent follow-up requested',
              'markedAt': '2026-05-03T03:42:00.000Z',
            },
            'monthSummary': {
              'present': 18,
              'absent': 1,
              'late': 2,
              'leave': 1,
              'totalMarked': 22,
              'attendancePercentage': 81.82,
            },
            'monthHistory': [
              {
                'date': '2026-05-01T00:00:00.000Z',
                'status': 'PRESENT',
                'label': 'Present on May 1',
              },
              {
                'date': '2026-05-02T00:00:00.000Z',
                'status': 'ABSENT',
                'remark': 'Medical note requested',
              },
            ],
          },
        ),
      );

      final snapshot = await repository.getParentAttendanceSnapshot(
        'child-1',
        DateTime(2026, 5),
      );

      expect(snapshot.summary.todayLabel, 'Absent today');
      expect(snapshot.summary.todayStatus, AttendanceStatus.absent);
      expect(snapshot.summary.todayRemark, 'Parent follow-up requested');
      expect(
        snapshot.summary.markedAt,
        DateTime.parse('2026-05-03T03:42:00.000Z'),
      );
      expect(snapshot.summary.presentCount, 18);
      expect(snapshot.summary.absentCount, 1);
      expect(snapshot.summary.lateCount, 2);
      expect(snapshot.summary.leaveCount, 1);
      expect(snapshot.summary.totalMarked, 22);
      expect(snapshot.summary.attendancePercentage, 81.82);
      expect(snapshot.days, hasLength(2));
      expect(snapshot.days.last.status, AttendanceStatus.absent);
      expect(snapshot.days.first.label, 'Present on May 1');
      expect(snapshot.days.last.remark, 'Medical note requested');

      verify(
        () => apiClient.get<dynamic>(
          '/mobile/students/child-1/attendance-summary',
          queryParameters: {'month': 5, 'year': 2026},
        ),
      ).called(1);
    });

    test('lists, creates, and cancels linked-child correction requests', () async {
      when(
        () => apiClient.get<dynamic>(
          '/mobile/students/child-1/attendance-corrections',
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path: '/mobile/students/child-1/attendance-corrections',
          ),
          data: {
            'items': [
              {
                'id': 'correction-1',
                'attendanceDate': '2026-07-24T00:00:00.000Z',
                'previousStatus': 'ABSENT',
                'requestedStatus': 'PRESENT',
                'reason': 'The child attended the full school day.',
                'status': 'PENDING',
                'requestedAt': '2026-07-25T04:00:00.000Z',
                'canCancel': true,
                'canResubmit': false,
              },
            ],
          },
        ),
      );
      when(
        () => apiClient.post<dynamic>(
          '/mobile/students/child-1/attendance-corrections',
          data: any(named: 'data'),
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path: '/mobile/students/child-1/attendance-corrections',
          ),
          data: {
            'id': 'correction-1',
            'attendanceDate': '2026-07-24T00:00:00.000Z',
            'previousStatus': 'ABSENT',
            'requestedStatus': 'PRESENT',
            'reason': 'The child attended the full school day.',
            'status': 'PENDING',
            'requestedAt': '2026-07-25T04:00:00.000Z',
          },
        ),
      );
      when(
        () => apiClient.post<dynamic>(
          '/mobile/students/child-1/attendance-corrections/correction-1/cancel',
          data: any(named: 'data'),
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path:
                '/mobile/students/child-1/attendance-corrections/correction-1/cancel',
          ),
          data: {
            'id': 'correction-1',
            'attendanceDate': '2026-07-24T00:00:00.000Z',
            'previousStatus': 'ABSENT',
            'requestedStatus': 'PRESENT',
            'reason': 'The child attended the full school day.',
            'status': 'CANCELLED',
            'requestedAt': '2026-07-25T04:00:00.000Z',
          },
        ),
      );

      final listed = await repository.getParentAttendanceCorrections('child-1');
      final created = await repository.createParentAttendanceCorrection(
        studentId: 'child-1',
        attendanceDate: DateTime.utc(2026, 7, 24),
        requestedStatus: AttendanceStatus.present,
        reason: 'The child attended the full school day.',
      );
      final cancelled = await repository.cancelParentAttendanceCorrection(
        studentId: 'child-1',
        requestId: 'correction-1',
        reason: 'The request was submitted by mistake.',
      );

      expect(listed.single.canCancel, isTrue);
      expect(listed.single.previousStatus, AttendanceStatus.absent);
      expect(created.status, 'PENDING');
      expect(cancelled.status, 'CANCELLED');
      final createPayload =
          verify(
                () => apiClient.post<dynamic>(
                  '/mobile/students/child-1/attendance-corrections',
                  data: captureAny(named: 'data'),
                ),
              ).captured.single
              as Map<String, dynamic>;
      expect(createPayload, {
        'attendanceDate': '2026-07-24',
        'requestedStatus': 'PRESENT',
        'reason': 'The child attended the full school day.',
      });
    });

    test(
      'loads teacher classes from purpose-limited mobile endpoint',
      () async {
        when(
          () => apiClient.get<dynamic>('/mobile/teacher/attendance/classes'),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(
              path: '/mobile/teacher/attendance/classes',
            ),
            data: {
              'items': [
                {
                  'id': 'year-1:class-1:section-1',
                  'academicYearId': 'year-1',
                  'classId': 'class-1',
                  'sectionId': 'section-1',
                  'name': 'Grade 3 - A',
                  'subject': 'Class teacher, Mathematics',
                },
              ],
            },
          ),
        );

        final snapshot = await repository.getTeacherAssignedClasses();
        final classes = snapshot.classes;

        expect(classes.single.id, 'year-1:class-1:section-1');
        expect(classes.single.academicYearId, 'year-1');
        expect(classes.single.classId, 'class-1');
        expect(classes.single.sectionId, 'section-1');
        expect(classes.single.subject, contains('Mathematics'));
      },
    );

    test(
      'loads the teacher today board from the mobile-safe endpoint',
      () async {
        when(
          () => apiClient.get<dynamic>(
            '/mobile/teacher/attendance/today',
            queryParameters: {'date': '2026-06-18'},
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(
              path: '/mobile/teacher/attendance/today',
            ),
            data: {
              'date': '2026-06-18T00:00:00.000Z',
              'pendingAttendanceCount': 1,
              'periods': [
                {
                  'id': 'slot-1',
                  'academicYearId': 'year-1',
                  'classId': 'class-1',
                  'sectionId': 'section-1',
                  'className': 'Grade 3 - A',
                  'subjectName': 'Mathematics',
                  'startsAt': '09:00',
                  'endsAt': '09:45',
                },
              ],
              'classes': [
                {
                  'id': 'year-1:class-1:section-1',
                  'academicYearId': 'year-1',
                  'classId': 'class-1',
                  'sectionId': 'section-1',
                  'name': 'Grade 3 - A',
                  'subject': 'Mathematics',
                  'attendance': {
                    'isSubmitted': false,
                    'isLocked': false,
                    'conflictStatus': 'NONE',
                  },
                },
              ],
            },
          ),
        );

        final today = await repository.getTeacherToday(DateTime(2026, 6, 18));

        expect(today.pendingAttendanceCount, 1);
        expect(today.periods.single.subjectName, 'Mathematics');
        expect(today.classes.single.attendance?.isSubmitted, isFalse);
      },
    );

    test('loads teacher roster and submits non-present exceptions', () async {
      const classSection = TeacherClassSection(
        id: 'year-1:class-1:section-1',
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        name: 'Grade 3 - A',
        subject: 'Mathematics',
      );

      when(
        () => apiClient.get<dynamic>(
          '/mobile/teacher/attendance/roster',
          queryParameters: {
            'academicYearId': 'year-1',
            'classId': 'class-1',
            'sectionId': 'section-1',
            'attendanceDate': '2026-06-02',
          },
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path: '/mobile/teacher/attendance/roster',
          ),
          data: {
            'students': [
              {
                'studentId': 'student-1',
                'studentName': 'Asha Sharma',
                'rollNumber': 7,
                'status': 'PRESENT',
              },
              {
                'studentId': 'student-2',
                'studentName': 'Bikash Thapa',
                'rollNumber': 8,
                'status': 'ABSENT',
              },
            ],
          },
        ),
      );
      when(
        () => apiClient.post<dynamic>(
          '/mobile/teacher/attendance/sync',
          data: any(named: 'data'),
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path: '/mobile/teacher/attendance/sync',
          ),
          data: {
            'attendanceSessionId': 'session-1',
            'syncStatus': 'ACCEPTED',
            'replayed': false,
          },
        ),
      );

      final roster = await repository.getClassAttendanceSheet(
        classSection,
        DateTime(2026, 6, 2),
      );
      final draft = await repository.saveDraftAttendanceLocally(
        classSection.id,
        DateTime(2026, 6, 2),
        roster.entries,
      );
      final submitResult = await repository.submitAttendance(
        classSection,
        DateTime(2026, 6, 2),
        roster.entries,
        draft.clientSubmissionId,
        draft.savedAt,
      );

      expect(roster.entries, hasLength(2));
      expect(roster.entries.first.rollNumber, '7');
      expect(roster.entries.last.status, AttendanceStatus.absent);
      expect(submitResult.status, AttendanceSyncStatus.synced);
      final payload =
          verify(
                () => apiClient.post<dynamic>(
                  '/mobile/teacher/attendance/sync',
                  data: captureAny(named: 'data'),
                ),
              ).captured.single
              as Map<String, dynamic>;
      expect(payload['academicYearId'], 'year-1');
      expect(payload['classId'], 'class-1');
      expect(payload['sectionId'], 'section-1');
      expect(payload['attendanceDate'], '2026-06-02');
      expect(payload['clientSubmissionId'], draft.clientSubmissionId);
      expect(
        payload['deviceTimestamp'],
        draft.savedAt.toUtc().toIso8601String(),
      );
      expect(payload['exceptions'], [
        {'studentId': 'student-2', 'status': 'ABSENT'},
      ]);
    });

    test(
      'loads teacher-scoped student summary with explicit class scope',
      () async {
        const classSection = TeacherClassSection(
          id: 'year-1:class-1:section-1',
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          name: 'Grade 3 - A',
          subject: 'Mathematics',
        );
        when(
          () => apiClient.get<dynamic>(
            '/mobile/teacher/students/student-1/summary',
            queryParameters: {
              'academicYearId': 'year-1',
              'classId': 'class-1',
              'sectionId': 'section-1',
            },
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(
              path: '/mobile/teacher/students/student-1/summary',
            ),
            data: {
              'student': {
                'id': 'student-1',
                'name': 'Asha Sharma',
                'studentSystemId': 'SCH-001',
                'rollNumber': 7,
                'lifecycleStatus': 'ACTIVE',
                'className': 'Grade 3',
                'sectionName': 'A',
              },
              'attendance': {
                'recentWindow': 2,
                'present': 1,
                'absent': 1,
                'late': 0,
                'leave': 0,
                'lastStatus': 'ABSENT',
                'lastRemark': 'Sick note pending',
              },
            },
          ),
        );

        final summary = await repository.getTeacherStudentSummary(
          classSection,
          'student-1',
        );

        expect(summary.student.name, 'Asha Sharma');
        expect(summary.student.studentSystemId, 'SCH-001');
        expect(summary.attendance.recentWindow, 2);
        expect(summary.attendance.lastStatus, 'ABSENT');
        verify(
          () => apiClient.get<dynamic>(
            '/mobile/teacher/students/student-1/summary',
            queryParameters: {
              'academicYearId': 'year-1',
              'classId': 'class-1',
              'sectionId': 'section-1',
            },
          ),
        ).called(1);
      },
    );

    test(
      'persists teacher draft attendance locally and clears after submit',
      () async {
        const classSection = TeacherClassSection(
          id: 'year-1:class-1:section-1',
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          name: 'Grade 3 - A',
          subject: 'Mathematics',
        );
        final date = DateTime(2026, 6, 2);
        const draftEntries = [
          AttendanceStudentEntry(
            studentId: 'student-1',
            studentName: 'Asha Sharma',
            rollNumber: '7',
            status: AttendanceStatus.present,
          ),
          AttendanceStudentEntry(
            studentId: 'student-2',
            studentName: 'Bikash Thapa',
            rollNumber: '8',
            status: AttendanceStatus.late,
          ),
        ];
        when(
          () => apiClient.post<dynamic>(
            '/mobile/teacher/attendance/sync',
            data: any(named: 'data'),
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(
              path: '/mobile/teacher/attendance/sync',
            ),
            data: {
              'attendanceSessionId': 'session-1',
              'syncStatus': 'ACCEPTED',
              'replayed': false,
            },
          ),
        );

        await repository.saveDraftAttendanceLocally(
          classSection.id,
          date,
          draftEntries,
        );
        final loadedDraft = await repository.loadDraftAttendance(
          classSection.id,
          date,
        );

        expect(loadedDraft, isNotNull);
        expect(loadedDraft!.entries, hasLength(2));
        expect(loadedDraft.entries.last.studentId, 'student-2');
        expect(loadedDraft.entries.last.status, AttendanceStatus.late);

        final updatedDraft = await repository.saveDraftAttendanceLocally(
          classSection.id,
          date,
          loadedDraft.entries,
        );
        expect(updatedDraft.clientSubmissionId, loadedDraft.clientSubmissionId);

        await repository.submitAttendance(
          classSection,
          date,
          loadedDraft.entries,
          loadedDraft.clientSubmissionId,
          loadedDraft.savedAt,
        );
        final clearedDraft = await repository.loadDraftAttendance(
          classSection.id,
          date,
        );

        expect(clearedDraft, isNull);
      },
    );

    test('keeps the secure draft when a 2xx receipt is REJECTED', () async {
      const classSection = TeacherClassSection(
        id: 'year-1:class-1:section-1',
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        name: 'Grade 3 - A',
        subject: 'Mathematics',
      );
      final date = DateTime(2026, 6, 2);
      const draftEntries = [
        AttendanceStudentEntry(
          studentId: 'student-1',
          studentName: 'Asha Sharma',
          rollNumber: '7',
          status: AttendanceStatus.absent,
        ),
      ];
      when(
        () => apiClient.post<dynamic>(
          '/mobile/teacher/attendance/sync',
          data: any(named: 'data'),
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path: '/mobile/teacher/attendance/sync',
          ),
          data: {'syncStatus': 'REJECTED', 'replayed': true},
        ),
      );
      final draft = await repository.saveDraftAttendanceLocally(
        classSection.id,
        date,
        draftEntries,
      );

      final result = await repository.submitAttendance(
        classSection,
        date,
        draftEntries,
        draft.clientSubmissionId,
        draft.savedAt,
      );

      expect(result.serverStatus, AttendanceServerSyncStatus.rejected);
      expect(result.status, AttendanceSyncStatus.failed);
      expect(result.canClearDeviceDraft, isFalse);
      final rejectedDraft = await repository.loadDraftAttendance(
        classSection.id,
        date,
      );
      expect(rejectedDraft, isNotNull);
      expect(rejectedDraft?.receiptState, AttendanceDraftReceiptState.rejected);

      const changedEntries = [
        AttendanceStudentEntry(
          studentId: 'student-1',
          studentName: 'Asha Sharma',
          rollNumber: '7',
          status: AttendanceStatus.late,
        ),
      ];
      final rotatedDraft = await repository.saveDraftAttendanceLocally(
        classSection.id,
        date,
        changedEntries,
      );
      expect(
        rotatedDraft.clientSubmissionId,
        isNot(rejectedDraft?.clientSubmissionId),
      );
      expect(rotatedDraft.receiptState, AttendanceDraftReceiptState.local);
      expect(rotatedDraft.entries.single.status, AttendanceStatus.late);
    });

    test('keeps the secure draft while a 2xx receipt is PROCESSING', () async {
      const classSection = TeacherClassSection(
        id: 'year-1:class-1:section-1',
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        name: 'Grade 3 - A',
        subject: 'Mathematics',
      );
      final date = DateTime(2026, 6, 2);
      const draftEntries = [
        AttendanceStudentEntry(
          studentId: 'student-1',
          studentName: 'Asha Sharma',
          rollNumber: '7',
          status: AttendanceStatus.absent,
        ),
      ];
      when(
        () => apiClient.post<dynamic>(
          '/mobile/teacher/attendance/sync',
          data: any(named: 'data'),
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path: '/mobile/teacher/attendance/sync',
          ),
          data: {'syncStatus': 'PROCESSING', 'replayed': true},
        ),
      );
      final draft = await repository.saveDraftAttendanceLocally(
        classSection.id,
        date,
        draftEntries,
      );

      final result = await repository.submitAttendance(
        classSection,
        date,
        draftEntries,
        draft.clientSubmissionId,
        draft.savedAt,
      );

      expect(result.serverStatus, AttendanceServerSyncStatus.processing);
      expect(result.status, AttendanceSyncStatus.serverChecking);
      expect(result.canClearDeviceDraft, isFalse);
      final processingDraft = await repository.loadDraftAttendance(
        classSection.id,
        date,
      );
      expect(processingDraft, isNotNull);
      expect(
        processingDraft?.receiptState,
        AttendanceDraftReceiptState.processing,
      );

      final sameContent = await repository.saveDraftAttendanceLocally(
        classSection.id,
        date,
        draftEntries,
      );
      expect(sameContent.clientSubmissionId, draft.clientSubmissionId);
      expect(sameContent.receiptState, AttendanceDraftReceiptState.processing);
      expect(
        () =>
            repository.saveDraftAttendanceLocally(classSection.id, date, const [
              AttendanceStudentEntry(
                studentId: 'student-1',
                studentName: 'Asha Sharma',
                rollNumber: '7',
                status: AttendanceStatus.late,
              ),
            ]),
        throwsA(isA<ConflictAppException>()),
      );
    });

    test('keeps the secure draft for an unknown 2xx sync status', () async {
      const classSection = TeacherClassSection(
        id: 'year-1:class-1:section-1',
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        name: 'Grade 3 - A',
        subject: 'Mathematics',
      );
      final date = DateTime(2026, 6, 2);
      const draftEntries = [
        AttendanceStudentEntry(
          studentId: 'student-1',
          studentName: 'Asha Sharma',
          rollNumber: '7',
          status: AttendanceStatus.absent,
        ),
      ];
      when(
        () => apiClient.post<dynamic>(
          '/mobile/teacher/attendance/sync',
          data: any(named: 'data'),
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path: '/mobile/teacher/attendance/sync',
          ),
          data: {'syncStatus': 'UNEXPECTED_STATUS'},
        ),
      );
      final draft = await repository.saveDraftAttendanceLocally(
        classSection.id,
        date,
        draftEntries,
      );

      final result = await repository.submitAttendance(
        classSection,
        date,
        draftEntries,
        draft.clientSubmissionId,
        draft.savedAt,
      );

      expect(result.serverStatus, AttendanceServerSyncStatus.unknown);
      expect(result.status, AttendanceSyncStatus.serverChecking);
      expect(result.canClearDeviceDraft, isFalse);
      final unknownDraft = await repository.loadDraftAttendance(
        classSection.id,
        date,
      );
      expect(unknownDraft, isNotNull);
      expect(unknownDraft?.receiptState, AttendanceDraftReceiptState.unknown);
    });

    test(
      'post-response storage failure keeps a durable ambiguous receipt lock',
      () async {
        const classSection = TeacherClassSection(
          id: 'year-1:class-1:section-1',
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          name: 'Grade 3 - A',
          subject: 'Mathematics',
        );
        final date = DateTime(2026, 6, 2);
        const draftEntries = [
          AttendanceStudentEntry(
            studentId: 'student-1',
            studentName: 'Asha Sharma',
            rollNumber: '7',
            status: AttendanceStatus.absent,
          ),
        ];
        when(
          () => apiClient.post<dynamic>(
            '/mobile/teacher/attendance/sync',
            data: any(named: 'data'),
          ),
        ).thenAnswer((_) async {
          secureStore.failNextWrites = 1;
          return Response(
            requestOptions: RequestOptions(
              path: '/mobile/teacher/attendance/sync',
            ),
            data: {'syncStatus': 'REJECTED', 'replayed': true},
          );
        });
        final draft = await repository.saveDraftAttendanceLocally(
          classSection.id,
          date,
          draftEntries,
        );

        final result = await repository.submitAttendance(
          classSection,
          date,
          draftEntries,
          draft.clientSubmissionId,
          draft.savedAt,
        );

        expect(result.serverStatus, AttendanceServerSyncStatus.rejected);
        expect(result.deviceReceiptPersisted, isFalse);
        final reloaded = await repository.loadDraftAttendance(
          classSection.id,
          date,
        );
        expect(
          reloaded?.receiptState,
          AttendanceDraftReceiptState.transportAmbiguous,
        );
        expect(reloaded?.clientSubmissionId, draft.clientSubmissionId);
        expect(
          () => repository
              .saveDraftAttendanceLocally(classSection.id, date, const [
                AttendanceStudentEntry(
                  studentId: 'student-1',
                  studentName: 'Asha Sharma',
                  rollNumber: '7',
                  status: AttendanceStatus.late,
                ),
              ]),
          throwsA(isA<ConflictAppException>()),
        );
      },
    );

    test('network ambiguity is locked before the attendance request', () async {
      const classSection = TeacherClassSection(
        id: 'year-1:class-1:section-1',
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        name: 'Grade 3 - A',
        subject: 'Mathematics',
      );
      final date = DateTime(2026, 6, 2);
      const draftEntries = [
        AttendanceStudentEntry(
          studentId: 'student-1',
          studentName: 'Asha Sharma',
          rollNumber: '7',
          status: AttendanceStatus.absent,
        ),
      ];
      when(
        () => apiClient.post<dynamic>(
          '/mobile/teacher/attendance/sync',
          data: any(named: 'data'),
        ),
      ).thenThrow(const NetworkException());
      final draft = await repository.saveDraftAttendanceLocally(
        classSection.id,
        date,
        draftEntries,
      );

      await expectLater(
        repository.submitAttendance(
          classSection,
          date,
          draftEntries,
          draft.clientSubmissionId,
          draft.savedAt,
        ),
        throwsA(isA<NetworkException>()),
      );

      final reloaded = await repository.loadDraftAttendance(
        classSection.id,
        date,
      );
      expect(
        reloaded?.receiptState,
        AttendanceDraftReceiptState.transportAmbiguous,
      );
      expect(reloaded?.clientSubmissionId, draft.clientSubmissionId);
    });

    test(
      'deterministic request rejection restores the prior local state',
      () async {
        const classSection = TeacherClassSection(
          id: 'year-1:class-1:section-1',
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          name: 'Grade 3 - A',
          subject: 'Mathematics',
        );
        final date = DateTime(2026, 6, 2);
        const draftEntries = [
          AttendanceStudentEntry(
            studentId: 'student-1',
            studentName: 'Asha Sharma',
            rollNumber: '7',
            status: AttendanceStatus.absent,
          ),
        ];
        when(
          () => apiClient.post<dynamic>(
            '/mobile/teacher/attendance/sync',
            data: any(named: 'data'),
          ),
        ).thenThrow(
          const ValidationException(message: 'Attendance was invalid.'),
        );
        final draft = await repository.saveDraftAttendanceLocally(
          classSection.id,
          date,
          draftEntries,
        );

        await expectLater(
          repository.submitAttendance(
            classSection,
            date,
            draftEntries,
            draft.clientSubmissionId,
            draft.savedAt,
          ),
          throwsA(isA<ValidationException>()),
        );

        final reloaded = await repository.loadDraftAttendance(
          classSection.id,
          date,
        );
        expect(reloaded?.receiptState, AttendanceDraftReceiptState.local);
        expect(reloaded?.clientSubmissionId, draft.clientSubmissionId);
      },
    );

    test(
      'transport-ambiguous receipt survives reload and rejects changed content',
      () async {
        final date = DateTime(2026, 6, 2);
        const draftEntries = [
          AttendanceStudentEntry(
            studentId: 'student-1',
            studentName: 'Asha Sharma',
            rollNumber: '7',
            status: AttendanceStatus.absent,
          ),
        ];
        final localDraft = await repository.saveDraftAttendanceLocally(
          'year-1:class-1:section-1',
          date,
          draftEntries,
        );

        await repository.markDraftReceiptState(
          'year-1:class-1:section-1',
          date,
          draftEntries,
          clientSubmissionId: localDraft.clientSubmissionId,
          receiptState: AttendanceDraftReceiptState.transportAmbiguous,
        );

        final reloaded = await repository.loadDraftAttendance(
          'year-1:class-1:section-1',
          date,
        );
        expect(
          reloaded?.receiptState,
          AttendanceDraftReceiptState.transportAmbiguous,
        );
        expect(reloaded?.clientSubmissionId, localDraft.clientSubmissionId);
        expect(
          () => repository.saveDraftAttendanceLocally(
            'year-1:class-1:section-1',
            date,
            const [
              AttendanceStudentEntry(
                studentId: 'student-1',
                studentName: 'Asha Sharma',
                rollNumber: '7',
                status: AttendanceStatus.leave,
              ),
            ],
          ),
          throwsA(isA<ConflictAppException>()),
        );
      },
    );

    test(
      'receipt transition fails closed on an ID or content mismatch',
      () async {
        final date = DateTime(2026, 6, 2);
        const draftEntries = [
          AttendanceStudentEntry(
            studentId: 'student-1',
            studentName: 'Asha Sharma',
            rollNumber: '7',
            status: AttendanceStatus.absent,
          ),
        ];
        final draft = await repository.saveDraftAttendanceLocally(
          'year-1:class-1:section-1',
          date,
          draftEntries,
        );

        expect(
          () => repository.markDraftReceiptState(
            'year-1:class-1:section-1',
            date,
            draftEntries,
            clientSubmissionId: '${draft.clientSubmissionId}-different',
            receiptState: AttendanceDraftReceiptState.processing,
          ),
          throwsA(isA<ConflictAppException>()),
        );
        expect(
          () => repository.markDraftReceiptState(
            'year-1:class-1:section-1',
            date,
            const [
              AttendanceStudentEntry(
                studentId: 'student-1',
                studentName: 'Asha Sharma',
                rollNumber: '7',
                status: AttendanceStatus.present,
              ),
            ],
            clientSubmissionId: draft.clientSubmissionId,
            receiptState: AttendanceDraftReceiptState.processing,
          ),
          throwsA(isA<ConflictAppException>()),
        );
      },
    );
  });
}

class _MemorySecureStore implements SecureKeyValueStore {
  final Map<String, String> values = {};
  int failNextWrites = 0;
  Completer<void>? _draftWriteStarted;
  Future<void>? _draftWriteRelease;

  void blockNextDraftWrite({
    required Completer<void> started,
    required Future<void> release,
  }) {
    _draftWriteStarted = started;
    _draftWriteRelease = release;
  }

  @override
  Future<void> write(String key, String value) async {
    if (failNextWrites > 0) {
      failNextWrites -= 1;
      throw StateError('Simulated secure-storage write failure.');
    }
    final draftWriteRelease = _draftWriteRelease;
    if (draftWriteRelease != null &&
        key.startsWith('schoolos.teacher_attendance_draft.secure.')) {
      _draftWriteRelease = null;
      _draftWriteStarted?.complete();
      _draftWriteStarted = null;
      await draftWriteRelease;
    }
    values[key] = value;
  }

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<Map<String, String>> readAll() async => Map.of(values);

  @override
  Future<void> delete(String key) async {
    values.remove(key);
  }

  @override
  Future<void> clearAll() async {
    values.clear();
  }

  @override
  Future<bool> containsKey(String key) async => values.containsKey(key);

  @override
  Future<void> deleteByPrefix(String prefix) async {
    values.removeWhere((key, _) => key.startsWith(prefix));
  }
}

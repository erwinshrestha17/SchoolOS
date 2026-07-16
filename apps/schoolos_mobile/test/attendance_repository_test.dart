import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/auth/mobile_role.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/storage/secure_storage_service.dart';
import 'package:schoolos_mobile/core/storage/teacher_attendance_draft_store.dart';
import 'package:schoolos_mobile/features/attendance/data/attendance_repository.dart';
import 'package:schoolos_mobile/features/attendance/domain/attendance_models.dart';

class MockApiClient extends Mock implements ApiClient {}

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
            'today': {'status': 'ABSENT', 'label': 'Absent today'},
            'monthSummary': {'present': 18, 'absent': 1, 'late': 2, 'leave': 1},
            'monthHistory': [
              {'date': '2026-05-01T00:00:00.000Z', 'status': 'PRESENT'},
              {'date': '2026-05-02T00:00:00.000Z', 'status': 'ABSENT'},
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
      expect(snapshot.summary.presentCount, 18);
      expect(snapshot.summary.absentCount, 1);
      expect(snapshot.summary.lateCount, 2);
      expect(snapshot.summary.leaveCount, 1);
      expect(snapshot.days, hasLength(2));
      expect(snapshot.days.last.status, AttendanceStatus.absent);

      verify(
        () => apiClient.get<dynamic>(
          '/mobile/students/child-1/attendance-summary',
          queryParameters: {'month': 5, 'year': 2026},
        ),
      ).called(1);
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

  @override
  Future<void> write(String key, String value) async {
    if (failNextWrites > 0) {
      failNextWrites -= 1;
      throw StateError('Simulated secure-storage write failure.');
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

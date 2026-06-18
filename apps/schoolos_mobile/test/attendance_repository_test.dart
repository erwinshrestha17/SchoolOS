import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/features/attendance/data/attendance_repository.dart';
import 'package:schoolos_mobile/features/attendance/domain/attendance_models.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  group('AttendanceRepository', () {
    late MockApiClient apiClient;
    late AttendanceRepository repository;

    setUp(() {
      SharedPreferences.setMockInitialValues({});
      apiClient = MockApiClient();
      repository = AttendanceRepository(apiClient);
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
          data: {'sessionId': 'session-1'},
        ),
      );

      final roster = await repository.getClassAttendanceSheet(
        classSection,
        DateTime(2026, 6, 2),
      );
      final submitResult = await repository.submitAttendance(
        classSection,
        DateTime(2026, 6, 2),
        roster.entries,
        'mobile-submit-1',
        DateTime.utc(2026, 6, 2, 8),
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
      expect(payload['clientSubmissionId'], 'mobile-submit-1');
      expect(payload['deviceTimestamp'], '2026-06-02T08:00:00.000Z');
      expect(payload['exceptions'], [
        {'studentId': 'student-2', 'status': 'ABSENT'},
      ]);
    });

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
            data: {'sessionId': 'session-1'},
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
  });
}

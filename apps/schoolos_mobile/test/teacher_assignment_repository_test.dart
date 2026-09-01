import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/features/teacher/data/teacher_repository.dart';

class _MockApiClient extends Mock implements ApiClient {}

void main() {
  test('counts backend-owned subject and homeroom assignment scopes', () async {
    final apiClient = _MockApiClient();
    when(
      () => apiClient.get<dynamic>('/teacher-workspace/assignments'),
    ).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/teacher-workspace/assignments'),
        data: {
          'hasAnyAssignment': true,
          'subjectAssignments': [
            {'assignmentId': 'subject-1'},
            {'assignmentId': 'subject-2'},
            {'assignmentId': 'subject-2'},
          ],
          'homerooms': [
            {'assignmentId': 'homeroom-1'},
          ],
        },
      ),
    );

    final count = await TeacherRepository(apiClient).getAssignmentScopeCount();

    expect(count, 3);
  });
}

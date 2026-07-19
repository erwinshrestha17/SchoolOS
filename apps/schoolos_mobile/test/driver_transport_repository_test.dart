import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/features/transport/data/driver_transport_repository.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  group('DriverTransportRepository', () {
    late MockApiClient apiClient;
    late DriverTransportRepository repository;

    setUp(() {
      apiClient = MockApiClient();
      repository = DriverTransportRepository(apiClient);
    });

    test('loads dashboard from driver transport endpoint', () async {
      when(
        () => apiClient.get<dynamic>('/transport/driver/dashboard'),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/transport/driver/dashboard'),
          data: {
            'assignments': [
              {
                'id': 'assignment-1',
                'route': {
                  'id': 'route-1',
                  'name': 'Kapan - Chabahil',
                  'code': 'R12',
                },
                'vehicle': {
                  'id': 'vehicle-1',
                  'registrationNumber': 'BA 2 PA 4005',
                  'model': 'Bus 3',
                  'capacity': 32,
                },
                'startsAt': '2026-06-02T07:00:00.000Z',
                'endsAt': null,
              },
            ],
            'activeTrips': [
              {
                'id': 'trip-1',
                'direction': 'PICKUP',
                'status': 'ACTIVE',
                'startedAt': '2026-06-02T07:25:00.000Z',
                'completedAt': null,
                'isDelayed': true,
                'delayMinutes': 8,
                'delayReason': 'Traffic',
                'route': {
                  'id': 'route-1',
                  'name': 'Kapan - Chabahil',
                  'code': 'R12',
                },
                'vehicle': {
                  'id': 'vehicle-1',
                  'registrationNumber': 'BA 2 PA 4005',
                  'model': 'Bus 3',
                  'capacity': 32,
                },
                'driverAssignmentId': 'assignment-1',
              },
            ],
            'recentTrips': [
              {
                'id': 'trip-0',
                'direction': 'DROPOFF',
                'status': 'COMPLETED',
                'startedAt': '2026-06-01T15:20:00.000Z',
                'completedAt': '2026-06-01T16:00:00.000Z',
                'isDelayed': false,
                'route': {
                  'id': 'route-1',
                  'name': 'Kapan - Chabahil',
                  'code': 'R12',
                },
                'vehicle': {'registrationNumber': 'BA 2 PA 4005'},
              },
            ],
          },
        ),
      );

      final dashboard = await repository.getDriverDashboard();

      expect(dashboard.hasWork, isTrue);
      expect(dashboard.assignments.single.id, 'assignment-1');
      expect(dashboard.assignments.single.routeCode, 'R12');
      expect(dashboard.assignments.single.vehicleCapacity, 32);
      expect(dashboard.assignments.single.isActive, isTrue);
      expect(dashboard.activeTrips.single.isActive, isTrue);
      expect(dashboard.activeTrips.single.isDelayed, isTrue);
      expect(dashboard.activeTrips.single.delayMinutes, 8);
      expect(dashboard.activeTrips.single.vehicleCapacity, 32);
      expect(dashboard.recentTrips.single.status, 'COMPLETED');

      verify(
        () => apiClient.get<dynamic>('/transport/driver/dashboard'),
      ).called(1);
    });

    test('loads driver trip history from history endpoint', () async {
      when(
        () => apiClient.get<dynamic>('/transport/driver/trips/history'),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path: '/transport/driver/trips/history',
          ),
          data: {
            'trips': [
              {
                'id': 'trip-history-1',
                'direction': 'DROPOFF',
                'status': 'COMPLETED',
                'startedAt': '2026-06-01T15:20:00.000Z',
                'completedAt': '2026-06-01T16:00:00.000Z',
                'isDelayed': false,
                'route': {
                  'id': 'route-1',
                  'name': 'Kapan - Chabahil',
                  'code': 'R12',
                },
                'vehicle': {
                  'id': 'vehicle-1',
                  'registrationNumber': 'BA 2 PA 4005',
                  'model': 'Bus 3',
                  'capacity': 32,
                },
              },
            ],
          },
        ),
      );

      final history = await repository.listDriverTripHistory();

      expect(history, hasLength(1));
      expect(history.single.id, 'trip-history-1');
      expect(history.single.status, 'COMPLETED');
      expect(history.single.routeCode, 'R12');
      expect(history.single.vehicleRegistration, 'BA 2 PA 4005');
      expect(history.single.vehicleCapacity, 32);

      verify(
        () => apiClient.get<dynamic>('/transport/driver/trips/history'),
      ).called(1);
    });

    test('loads manifest and sends driver trip actions', () async {
      when(
        () => apiClient.get<dynamic>('/transport/driver/trips/trip-1/manifest'),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(
            path: '/transport/driver/trips/trip-1/manifest',
          ),
          data: {
            'trip': {
              'id': 'trip-1',
              'direction': 'PICKUP',
              'status': 'ACTIVE',
              'startedAt': '2026-06-02T07:25:00.000Z',
              'isDelayed': false,
            },
            'route': {
              'id': 'route-1',
              'name': 'Kapan - Chabahil',
              'code': 'R12',
              'stops': [
                {'id': 'stop-1', 'name': 'Kapan', 'sequence': 1},
              ],
            },
            'vehicle': {
              'id': 'vehicle-1',
              'registrationNumber': 'BA 2 PA 4005',
              'model': 'Bus 3',
              'capacity': 32,
            },
            'students': [
              {
                'statusId': 'status-1',
                'status': 'PENDING',
                'student': {
                  'id': 'student-1',
                  'studentSystemId': 'SCH-001',
                  'firstNameEn': 'Asha',
                  'lastNameEn': 'Rai',
                  'rollNumber': 7,
                  'emergencyName': 'Parent',
                  'emergencyPhone': '9800000000',
                },
                'stop': {'id': 'stop-1', 'name': 'Kapan', 'sequence': 1},
              },
            ],
          },
        ),
      );
      when(
        () => apiClient.patch<dynamic>(any(), data: any(named: 'data')),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: ''),
          data: {},
        ),
      );
      when(
        () => apiClient.post<dynamic>(any(), data: any(named: 'data')),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: ''),
          data: {},
        ),
      );

      final manifest = await repository.getDriverTripManifest('trip-1');
      await repository.markStudentBoarded('trip-1', 'student-1');
      await repository.markStudentDropped('trip-1', 'student-1');
      await repository.markStudentAbsent('trip-1', 'student-1');
      await repository.completeTrip('trip-1', notes: 'Safe arrival');
      await repository.recordLocationPing(
        'trip-1',
        latitude: 27.7101,
        longitude: 85.3222,
        speedKph: 18.5,
        heading: 90,
        recordedAt: '2026-06-02T07:45:00.000Z',
      );

      expect(manifest.trip.isActive, isTrue);
      expect(manifest.route.code, 'R12');
      expect(manifest.route.stops.single.sequence, 1);
      expect(manifest.vehicle.capacity, 32);
      expect(manifest.students.single.studentId, 'student-1');
      expect(manifest.students.single.name, 'Asha Rai');
      expect(manifest.students.single.rollNumber, '7');

      verify(
        () => apiClient.get<dynamic>('/transport/driver/trips/trip-1/manifest'),
      ).called(1);
      final boardedPayload =
          verify(
                () => apiClient.patch<dynamic>(
                  '/transport/driver/trips/trip-1/students/boarded',
                  data: captureAny(named: 'data'),
                ),
              ).captured.single
              as Map<String, dynamic>;
      expect(boardedPayload, {'studentId': 'student-1'});
      final droppedPayload =
          verify(
                () => apiClient.patch<dynamic>(
                  '/transport/driver/trips/trip-1/students/dropped',
                  data: captureAny(named: 'data'),
                ),
              ).captured.single
              as Map<String, dynamic>;
      expect(droppedPayload, {'studentId': 'student-1'});
      final absentPayload =
          verify(
                () => apiClient.patch<dynamic>(
                  '/transport/driver/trips/trip-1/students/absent',
                  data: captureAny(named: 'data'),
                ),
              ).captured.single
              as Map<String, dynamic>;
      expect(absentPayload, {'studentId': 'student-1', 'absent': true});
      final completePayload =
          verify(
                () => apiClient.patch<dynamic>(
                  '/transport/driver/trips/trip-1/complete',
                  data: captureAny(named: 'data'),
                ),
              ).captured.single
              as Map<String, dynamic>;
      expect(completePayload, {'notes': 'Safe arrival'});
      final locationPayload =
          verify(
                () => apiClient.post<dynamic>(
                  '/transport/driver/trips/trip-1/location',
                  data: captureAny(named: 'data'),
                ),
              ).captured.single
              as Map<String, dynamic>;
      expect(locationPayload, {
        'latitude': 27.7101,
        'longitude': 85.3222,
        'speedKph': 18.5,
        'heading': 90,
        'recordedAt': '2026-06-02T07:45:00.000Z',
      });
    });

    test(
      'records an emergency contact attempt and returns guardian details',
      () async {
        when(
          () => apiClient.post<dynamic>(
            '/transport/driver/trips/trip-1/emergency-contact',
            data: any(named: 'data'),
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: ''),
            data: {
              'studentName': 'Asha Rai',
              'emergencyName': 'Parent',
              'emergencyPhone': '9800000000',
              'channel': 'CALL',
              'reason': 'Not at stop',
              'recordedAt': '2026-06-02T07:50:00.000Z',
            },
          ),
        );

        final result = await repository.recordEmergencyContact(
          'trip-1',
          'student-1',
          reason: 'Not at stop',
        );

        expect(result.studentName, 'Asha Rai');
        expect(result.emergencyName, 'Parent');
        expect(result.emergencyPhone, '9800000000');
        expect(result.channel, 'CALL');

        final payload =
            verify(
                  () => apiClient.post<dynamic>(
                    '/transport/driver/trips/trip-1/emergency-contact',
                    data: captureAny(named: 'data'),
                  ),
                ).captured.single
                as Map<String, dynamic>;
        expect(payload, {
          'studentId': 'student-1',
          'reason': 'Not at stop',
          'channel': 'CALL',
        });
      },
    );
  });
}

import '../../../core/network/api_client.dart';
import '../domain/driver_transport_models.dart';

class DriverTransportRepository {
  const DriverTransportRepository(this._client);

  final ApiClient _client;

  Future<DriverTransportDashboard> getDriverDashboard() async {
    final response = await _client.get('/transport/driver/dashboard');
    final data = response.data as Map<String, dynamic>;
    return DriverTransportDashboard.fromJson(data);
  }

  Future<DriverTripManifest> getDriverTripManifest(String tripId) async {
    final response = await _client.get(
      '/transport/driver/trips/$tripId/manifest',
    );
    final data = response.data as Map<String, dynamic>;
    return DriverTripManifest.fromJson(data);
  }

  Future<void> markStudentBoarded(String tripId, String studentId) async {
    await _client.patch(
      '/transport/driver/trips/$tripId/students/boarded',
      data: {'studentId': studentId},
    );
  }

  Future<void> markStudentDropped(String tripId, String studentId) async {
    await _client.patch(
      '/transport/driver/trips/$tripId/students/dropped',
      data: {'studentId': studentId},
    );
  }

  Future<void> markStudentAbsent(String tripId, String studentId) async {
    await _client.patch(
      '/transport/driver/trips/$tripId/students/absent',
      data: {'studentId': studentId, 'absent': true},
    );
  }

  Future<void> completeTrip(String tripId, {String? notes}) async {
    await _client.patch(
      '/transport/driver/trips/$tripId/complete',
      data: {
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      },
    );
  }

  Future<void> recordLocationPing(
    String tripId, {
    required num latitude,
    required num longitude,
    num? speedKph,
    num? heading,
    String? recordedAt,
  }) async {
    final data = <String, dynamic>{
      'latitude': latitude,
      'longitude': longitude,
    };
    if (speedKph != null) {
      data['speedKph'] = speedKph;
    }
    if (heading != null) {
      data['heading'] = heading;
    }
    if (recordedAt != null) {
      data['recordedAt'] = recordedAt;
    }

    await _client.post('/transport/driver/trips/$tripId/location', data: data);
  }
}

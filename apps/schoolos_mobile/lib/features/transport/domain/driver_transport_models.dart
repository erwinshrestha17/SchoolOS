class DriverTransportDashboard {
  const DriverTransportDashboard({
    this.assignments = const [],
    this.activeTrips = const [],
    this.recentTrips = const [],
  });

  final List<DriverTransportAssignment> assignments;
  final List<DriverTransportTrip> activeTrips;
  final List<DriverTransportTrip> recentTrips;

  bool get hasWork =>
      assignments.isNotEmpty ||
      activeTrips.isNotEmpty ||
      recentTrips.isNotEmpty;

  factory DriverTransportDashboard.fromJson(Map<String, dynamic> json) {
    return DriverTransportDashboard(
      assignments: _asList(json['assignments'])
          .whereType<Map<String, dynamic>>()
          .map(DriverTransportAssignment.fromJson)
          .toList(),
      activeTrips: _asList(json['activeTrips'])
          .whereType<Map<String, dynamic>>()
          .map(DriverTransportTrip.fromJson)
          .toList(),
      recentTrips: _asList(json['recentTrips'])
          .whereType<Map<String, dynamic>>()
          .map(DriverTransportTrip.fromJson)
          .toList(),
    );
  }
}

class DriverTransportAssignment {
  const DriverTransportAssignment({
    required this.id,
    this.routeName,
    this.routeCode,
    required this.vehicleRegistration,
    this.vehicleModel,
    required this.vehicleCapacity,
    this.startsAt,
    this.endsAt,
  });

  final String id;
  final String? routeName;
  final String? routeCode;
  final String vehicleRegistration;
  final String? vehicleModel;
  final int vehicleCapacity;
  final String? startsAt;
  final String? endsAt;

  bool get isActive => endsAt == null || endsAt!.isEmpty;

  factory DriverTransportAssignment.fromJson(Map<String, dynamic> json) {
    final route = _asMap(json['route']);
    final vehicle = _asMap(json['vehicle']);

    return DriverTransportAssignment(
      id: json['id'] as String? ?? '',
      routeName: route?['name'] as String?,
      routeCode: route?['code'] as String?,
      vehicleRegistration:
          vehicle?['registrationNumber'] as String? ?? 'Vehicle',
      vehicleModel: vehicle?['model'] as String?,
      vehicleCapacity: _asInt(vehicle?['capacity']),
      startsAt: json['startsAt'] as String?,
      endsAt: json['endsAt'] as String?,
    );
  }
}

class DriverTransportTrip {
  const DriverTransportTrip({
    required this.id,
    required this.direction,
    required this.status,
    this.startedAt,
    this.completedAt,
    this.isDelayed = false,
    this.delayMinutes,
    this.delayReason,
    this.routeName,
    this.routeCode,
    this.vehicleRegistration,
    this.vehicleModel,
    this.vehicleCapacity = 0,
    this.driverAssignmentId,
  });

  final String id;
  final String direction;
  final String status;
  final String? startedAt;
  final String? completedAt;
  final bool isDelayed;
  final int? delayMinutes;
  final String? delayReason;
  final String? routeName;
  final String? routeCode;
  final String? vehicleRegistration;
  final String? vehicleModel;
  final int vehicleCapacity;
  final String? driverAssignmentId;

  bool get isActive => status == 'ACTIVE';

  factory DriverTransportTrip.fromJson(Map<String, dynamic> json) {
    final route = _asMap(json['route']);
    final vehicle = _asMap(json['vehicle']);

    return DriverTransportTrip(
      id: json['id'] as String? ?? '',
      direction: json['direction'] as String? ?? 'PICKUP',
      status: json['status'] as String? ?? 'UNKNOWN',
      startedAt: json['startedAt'] as String?,
      completedAt: json['completedAt'] as String?,
      isDelayed: json['isDelayed'] as bool? ?? false,
      delayMinutes: _asNullableInt(json['delayMinutes']),
      delayReason: json['delayReason'] as String?,
      routeName: route?['name'] as String?,
      routeCode: route?['code'] as String?,
      vehicleRegistration: vehicle?['registrationNumber'] as String?,
      vehicleModel: vehicle?['model'] as String?,
      vehicleCapacity: _asInt(vehicle?['capacity']),
      driverAssignmentId: json['driverAssignmentId'] as String?,
    );
  }
}

class DriverTripManifest {
  const DriverTripManifest({
    required this.trip,
    required this.route,
    required this.vehicle,
    this.students = const [],
  });

  final DriverManifestTrip trip;
  final DriverManifestRoute route;
  final DriverManifestVehicle vehicle;
  final List<DriverManifestStudent> students;

  factory DriverTripManifest.fromJson(Map<String, dynamic> json) {
    return DriverTripManifest(
      trip: DriverManifestTrip.fromJson(_asMap(json['trip']) ?? const {}),
      route: DriverManifestRoute.fromJson(_asMap(json['route']) ?? const {}),
      vehicle: DriverManifestVehicle.fromJson(
        _asMap(json['vehicle']) ?? const {},
      ),
      students: _asList(json['students'])
          .whereType<Map<String, dynamic>>()
          .map(DriverManifestStudent.fromJson)
          .toList(),
    );
  }
}

class DriverManifestTrip {
  const DriverManifestTrip({
    required this.id,
    required this.direction,
    required this.status,
    this.startedAt,
    this.completedAt,
    this.isDelayed = false,
    this.delayMinutes,
    this.delayReason,
  });

  final String id;
  final String direction;
  final String status;
  final String? startedAt;
  final String? completedAt;
  final bool isDelayed;
  final int? delayMinutes;
  final String? delayReason;

  bool get isActive => status == 'ACTIVE';

  factory DriverManifestTrip.fromJson(Map<String, dynamic> json) {
    return DriverManifestTrip(
      id: json['id'] as String? ?? '',
      direction: json['direction'] as String? ?? 'PICKUP',
      status: json['status'] as String? ?? 'UNKNOWN',
      startedAt: json['startedAt'] as String?,
      completedAt: json['completedAt'] as String?,
      isDelayed: json['isDelayed'] as bool? ?? false,
      delayMinutes: _asNullableInt(json['delayMinutes']),
      delayReason: json['delayReason'] as String?,
    );
  }
}

class DriverManifestRoute {
  const DriverManifestRoute({
    required this.id,
    this.name,
    this.code,
    this.stops = const [],
  });

  final String id;
  final String? name;
  final String? code;
  final List<DriverManifestStop> stops;

  factory DriverManifestRoute.fromJson(Map<String, dynamic> json) {
    return DriverManifestRoute(
      id: json['id'] as String? ?? '',
      name: json['name'] as String?,
      code: json['code'] as String?,
      stops: _asList(json['stops'])
          .whereType<Map<String, dynamic>>()
          .map(DriverManifestStop.fromJson)
          .toList(),
    );
  }
}

class DriverManifestStop {
  const DriverManifestStop({
    required this.id,
    this.name,
    this.sequence,
    this.estimatedPickup,
    this.estimatedDrop,
  });

  final String id;
  final String? name;
  final int? sequence;
  final String? estimatedPickup;
  final String? estimatedDrop;

  factory DriverManifestStop.fromJson(Map<String, dynamic> json) {
    return DriverManifestStop(
      id: json['id'] as String? ?? '',
      name: json['name'] as String?,
      sequence: _asNullableInt(json['sequence']),
      estimatedPickup: json['estimatedPickup'] as String?,
      estimatedDrop: json['estimatedDrop'] as String?,
    );
  }
}

class DriverManifestVehicle {
  const DriverManifestVehicle({
    required this.id,
    this.registrationNumber,
    this.model,
    this.capacity = 0,
  });

  final String id;
  final String? registrationNumber;
  final String? model;
  final int capacity;

  factory DriverManifestVehicle.fromJson(Map<String, dynamic> json) {
    return DriverManifestVehicle(
      id: json['id'] as String? ?? '',
      registrationNumber: json['registrationNumber'] as String?,
      model: json['model'] as String?,
      capacity: _asInt(json['capacity']),
    );
  }
}

class DriverManifestStudent {
  const DriverManifestStudent({
    required this.statusId,
    required this.status,
    required this.studentId,
    this.studentSystemId,
    this.name,
    this.rollNumber,
    this.boardedAt,
    this.droppedAt,
    this.notes,
    this.stopName,
    this.stopSequence,
    this.medicalConditions,
    this.severeAllergies,
    this.emergencyName,
    this.emergencyPhone,
  });

  final String statusId;
  final String status;
  final String studentId;
  final String? studentSystemId;
  final String? name;
  final String? rollNumber;
  final String? boardedAt;
  final String? droppedAt;
  final String? notes;
  final String? stopName;
  final int? stopSequence;
  final String? medicalConditions;
  final String? severeAllergies;
  final String? emergencyName;
  final String? emergencyPhone;

  bool get isBoarded => status == 'BOARDED';
  bool get isDropped => status == 'DROPPED';
  bool get isAbsent => status == 'ABSENT';

  factory DriverManifestStudent.fromJson(Map<String, dynamic> json) {
    final student = _asMap(json['student']);
    final stop = _asMap(json['stop']);
    final firstName = student?['firstNameEn'] as String? ?? '';
    final lastName = student?['lastNameEn'] as String? ?? '';
    final fullName = [
      firstName,
      lastName,
    ].where((part) => part.trim().isNotEmpty).join(' ');

    return DriverManifestStudent(
      statusId: json['statusId'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      studentId: student?['id'] as String? ?? '',
      studentSystemId: student?['studentSystemId'] as String?,
      name: fullName.isEmpty ? null : fullName,
      rollNumber: _asNullableInt(student?['rollNumber'])?.toString(),
      boardedAt: json['boardedAt'] as String?,
      droppedAt: json['droppedAt'] as String?,
      notes: json['notes'] as String?,
      stopName: stop?['name'] as String?,
      stopSequence: _asNullableInt(stop?['sequence']),
      medicalConditions: student?['medicalConditions'] as String?,
      severeAllergies: student?['severeAllergies'] as String?,
      emergencyName: student?['emergencyName'] as String?,
      emergencyPhone: student?['emergencyPhone'] as String?,
    );
  }
}

Map<String, dynamic>? _asMap(Object? value) {
  return value is Map<String, dynamic> ? value : null;
}

List<dynamic> _asList(Object? value) {
  return value is List<dynamic> ? value : const [];
}

int _asInt(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.round();
  }
  if (value is String) {
    return int.tryParse(value) ?? 0;
  }
  return 0;
}

int? _asNullableInt(Object? value) {
  if (value == null) {
    return null;
  }
  return _asInt(value);
}

import 'package:permission_handler/permission_handler.dart' as permissions;
import 'package:flutter_riverpod/flutter_riverpod.dart';

final permissionServiceProvider = Provider<PermissionService>((ref) {
  return const PermissionService();
});

class PermissionService {
  const PermissionService();

  Future<bool> requestCameraPermission() async {
    final status = await permissions.Permission.camera.request();
    return status == permissions.PermissionStatus.granted;
  }

  Future<bool> hasCameraPermission() async {
    return await permissions.Permission.camera.status ==
        permissions.PermissionStatus.granted;
  }

  Future<bool> requestLocationPermission() async {
    final status = await permissions.Permission.location.request();
    return status == permissions.PermissionStatus.granted;
  }

  Future<bool> hasLocationPermission() async {
    return await permissions.Permission.location.status ==
        permissions.PermissionStatus.granted;
  }

  Future<bool> requestPhotosPermission() async {
    final status = await permissions.Permission.photos.request();
    return status == permissions.PermissionStatus.granted;
  }

  Future<bool> hasPhotosPermission() async {
    return await permissions.Permission.photos.status ==
        permissions.PermissionStatus.granted;
  }

  Future<bool> requestNotificationPermission() async {
    final status = await permissions.Permission.notification.request();
    return status == permissions.PermissionStatus.granted;
  }

  Future<bool> hasNotificationPermission() async {
    return await permissions.Permission.notification.status ==
        permissions.PermissionStatus.granted;
  }

  Future<bool> openAppSettings() async {
    return permissions.openAppSettings();
  }
}

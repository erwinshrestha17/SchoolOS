import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final permissionServiceProvider = Provider<PermissionService>((ref) {
  return const PermissionService();
});

class PermissionService {
  const PermissionService();

  Future<bool> requestCameraPermission() async {
    final status = await Permission.camera.request();
    return status.isGranted;
  }

  Future<bool> hasCameraPermission() async {
    return Permission.camera.isGranted;
  }

  Future<bool> requestLocationPermission() async {
    final status = await Permission.location.request();
    return status.isGranted;
  }

  Future<bool> hasLocationPermission() async {
    return Permission.location.isGranted;
  }

  Future<bool> requestPhotosPermission() async {
    final status = await Permission.photos.request();
    return status.isGranted;
  }

  Future<bool> hasPhotosPermission() async {
    return Permission.photos.isGranted;
  }

  Future<bool> requestNotificationPermission() async {
    final status = await Permission.notification.request();
    return status.isGranted;
  }

  Future<bool> hasNotificationPermission() async {
    return Permission.notification.isGranted;
  }

  Future<bool> openAppSettings() async {
    return openAppSettings();
  }
}

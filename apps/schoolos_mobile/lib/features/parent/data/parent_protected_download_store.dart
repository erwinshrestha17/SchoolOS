import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

import '../../../core/auth/mobile_role.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/storage/private_read_cache.dart';

/// Temporary protected files belong to one signed-in guardian and one child.
/// A live linked-child refresh and a download write share a queue so a late
/// response cannot recreate a file after that child's access was removed.
class ParentProtectedDownloadStore {
  ParentProtectedDownloadStore({required this.scope});

  final PrivateReadCacheScope? scope;
  Future<void> _pending = Future<void>.value();
  Set<String>? _linkedChildIds;

  bool get hasValidScope =>
      scope?.isValid == true && scope?.role == MobileRole.parent;

  static const _legacyBuckets = [
    'receipts',
    'report-cards',
    'documents',
    'homework-attachments',
    'service-request-evidence',
  ];
  static final _safeBucket = RegExp(r'^[a-z-]+$');
  static final _safeFileName = RegExp(r'^[a-zA-Z0-9._-]+$');

  Future<File> save({
    required String childId,
    required String bucket,
    required String recordId,
    required String fileName,
    required List<int> bytes,
  }) => _serialized(() async {
    final namespace = _namespace();
    if (childId.isEmpty ||
        recordId.isEmpty ||
        !_safeBucket.hasMatch(bucket) ||
        !_safeFileName.hasMatch(fileName) ||
        fileName == '.' ||
        fileName == '..' ||
        (_linkedChildIds != null && !_linkedChildIds!.contains(childId))) {
      throw const PermissionException(
        'This child or file is no longer available.',
        'ACCESS_CHANGED',
      );
    }

    final root = await getTemporaryDirectory();
    final directory = Directory(
      '${root.path}/schoolos/parent-downloads/$namespace/${_key(childId)}/$bucket/${_key(recordId)}',
    );
    await directory.create(recursive: true);
    final file = File('${directory.path}/$fileName');
    await file.writeAsBytes(bytes, flush: true);
    return file;
  });

  /// Call only after the server answers the linked-children request. An
  /// offline cached list is not evidence that a revoked child remains linked.
  Future<void> pruneUnlinked(Iterable<String> linkedChildIds) =>
      _serialized(() async {
        final namespace = _namespace();
        final linked = linkedChildIds.toSet();
        final root = await getTemporaryDirectory();
        final schoolOs = Directory('${root.path}/schoolos');

        // Prior versions saved parent downloads without an identity or child
        // namespace. Their owner cannot be established, so remove them all.
        for (final bucket in _legacyBuckets) {
          final legacy = Directory('${schoolOs.path}/$bucket');
          if (await legacy.exists()) await legacy.delete(recursive: true);
        }

        final guardianRoot = Directory(
          '${schoolOs.path}/parent-downloads/$namespace',
        );
        if (await guardianRoot.exists()) {
          final allowed = linked.map(_key).toSet();
          await for (final childDirectory in guardianRoot.list(
            followLinks: false,
          )) {
            if (childDirectory is Directory &&
                !allowed.contains(
                  childDirectory.uri.pathSegments
                      .where((segment) => segment.isNotEmpty)
                      .last,
                )) {
              await childDirectory.delete(recursive: true);
            }
          }
        }
        _linkedChildIds = linked;
      });

  String _namespace() {
    final current = scope;
    if (current == null || !hasValidScope) {
      throw const PermissionException(
        'Parent file access requires a signed-in guardian.',
        'ACCESS_CHANGED',
      );
    }
    return _key(current.namespace);
  }

  static String _key(String value) =>
      base64Url.encode(utf8.encode(value)).replaceAll('=', '');

  Future<T> _serialized<T>(Future<T> Function() action) {
    final result = _pending.then((_) => action());
    _pending = result.then<void>(
      (_) {},
      onError: (Object _, StackTrace stack) {},
    );
    return result;
  }
}

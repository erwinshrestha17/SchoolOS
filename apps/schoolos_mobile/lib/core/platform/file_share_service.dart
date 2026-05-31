import 'package:flutter/services.dart';

class FileShareService {
  const FileShareService();

  static const MethodChannel _channel = MethodChannel(
    'schoolos_mobile/file_share',
  );

  Future<void> shareFile({
    required String filePath,
    required String mimeType,
    required String subject,
  }) async {
    await _channel.invokeMethod<void>('shareFile', {
      'path': filePath,
      'mimeType': mimeType,
      'subject': subject,
    });
  }
}

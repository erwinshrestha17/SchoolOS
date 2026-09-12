import 'dart:io';
import 'package:flutter/services.dart';

Future<void> loadAppGoldenFonts() async {
  await loadGoldenFont('Inter', [
    'assets/fonts/Inter-Regular.ttf',
    'assets/fonts/Inter-Medium.ttf',
    'assets/fonts/Inter-SemiBold.ttf',
    'assets/fonts/Inter-Bold.ttf',
  ]);
  await loadGoldenFont('MaterialIcons', [
    'build/unit_test_assets/fonts/MaterialIcons-Regular.otf',
  ]);
}

Future<void> loadGoldenFont(String family, List<String> paths) async {
  final loader = FontLoader(family);
  for (final path in paths) {
    final file = File(path);
    if (!file.existsSync()) {
      throw StateError(
        'Golden font missing: $path. Run `flutter test` from '
        'apps/schoolos_mobile so relative asset paths resolve.',
      );
    }
    loader.addFont(
      file.readAsBytes().then((bytes) => ByteData.sublistView(bytes)),
    );
  }
  await loader.load();
}

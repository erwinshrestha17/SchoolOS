import 'package:flutter_riverpod/flutter_riverpod.dart';

final connectivityProvider = StateNotifierProvider<ConnectivityNotifier, bool>((
  ref,
) {
  return ConnectivityNotifier();
});

class ConnectivityNotifier extends StateNotifier<bool> {
  ConnectivityNotifier() : super(true); // Default is online

  /// Simulated toggle for manual offline testing (e.g. settings page)
  void setOnline(bool isOnline) {
    state = isOnline;
  }

  void toggle() {
    state = !state;
  }
}

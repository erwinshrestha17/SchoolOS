import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final connectivityServiceProvider = Provider<Connectivity>((ref) {
  return Connectivity();
});

final connectivityProvider = StateNotifierProvider<ConnectivityNotifier, bool>((
  ref,
) {
  return ConnectivityNotifier(ref.watch(connectivityServiceProvider));
});

class ConnectivityNotifier extends StateNotifier<bool> {
  ConnectivityNotifier(this._connectivity) : super(true) {
    _subscription = _connectivity.onConnectivityChanged.listen(
      _update,
      onError: (_) {},
    );
    unawaited(_loadInitialState());
  }

  final Connectivity _connectivity;
  StreamSubscription<List<ConnectivityResult>>? _subscription;

  Future<void> _loadInitialState() async {
    try {
      _update(await _connectivity.checkConnectivity());
    } catch (_) {
      // Keep the optimistic initial state when the platform cannot report
      // connectivity. Requests still fail through the network error mapper.
    }
  }

  void _update(List<ConnectivityResult> results) {
    state = results.any((result) => result != ConnectivityResult.none);
  }

  /// Test seam for deterministic connectivity state overrides.
  void setOnline(bool isOnline) {
    state = isOnline;
  }

  @override
  void dispose() {
    unawaited(_subscription?.cancel());
    super.dispose();
  }
}

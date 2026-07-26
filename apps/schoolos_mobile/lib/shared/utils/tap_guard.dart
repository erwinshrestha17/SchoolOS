import 'package:flutter/widgets.dart';

/// Swallows the second and third tap of an accidental double-tap.
///
/// A `context.push` fired twice stacks the same screen twice, and the parent
/// then has to press back two or three times to get out. Guarding at the call
/// site rather than inside a button keeps the widgets presentation-only.
///
/// Implemented as a timestamp check rather than a [Timer] on purpose: a
/// pending timer outlives `pumpAndSettle` and fails widget tests at teardown.
mixin TapGuardMixin<T extends StatefulWidget> on State<T> {
  static const defaultWindow = Duration(milliseconds: 700);

  DateTime? _lastAccepted;

  /// True when this tap should be acted on, false when it repeats one that was
  /// just accepted.
  bool acceptTap({Duration window = defaultWindow}) {
    final now = DateTime.now();
    final last = _lastAccepted;
    if (last != null && now.difference(last) < window) {
      return false;
    }
    _lastAccepted = now;
    return true;
  }

  /// Wraps [action] so repeat taps inside the guard window do nothing.
  /// Returns null when [action] is null, so a disabled control stays disabled.
  VoidCallback? guardTap(VoidCallback? action) {
    if (action == null) return null;
    return () {
      if (acceptTap()) action();
    };
  }
}

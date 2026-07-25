import 'package:flutter/material.dart';

/// Ties the lifetime of caller-owned resources to the subtree that uses them.
///
/// Modal sheets are commonly written as a function that creates its
/// [TextEditingController]s, shows the sheet, and disposes them when the sheet
/// future completes. That disposes too early: the sheet future completes the
/// moment the route is popped, while the sheet keeps rebuilding through its
/// closing transition, so the still-mounted `TextField` reaches a disposed
/// controller and trips `A TextEditingController was used after being
/// disposed.`
///
/// Wrapping the sheet body in a [DisposeScope] moves disposal to
/// [State.dispose], which runs when the subtree is actually unmounted.
///
/// ```dart
/// final reason = TextEditingController();
/// showModalBottomSheet<void>(
///   context: context,
///   builder: (sheetContext) => DisposeScope(
///     onDispose: reason.dispose,
///     child: ...,
///   ),
/// );
/// ```
class DisposeScope extends StatefulWidget {
  const DisposeScope({super.key, required this.onDispose, required this.child});

  /// Called once, when this widget leaves the tree.
  final VoidCallback onDispose;

  final Widget child;

  @override
  State<DisposeScope> createState() => _DisposeScopeState();
}

class _DisposeScopeState extends State<DisposeScope> {
  @override
  void dispose() {
    widget.onDispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

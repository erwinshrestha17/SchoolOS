import '../auth/auth_provider.dart';
import 'push_deep_link_resolver.dart';

/// A push is only a navigation hint. Both its destination scope and the exact
/// authenticated state that requested navigation must still hold after lookup.
Future<void> openPushNotificationForSession({
  required AuthState auth,
  required AuthState Function() readAuth,
  required Map<String, dynamic> payload,
  required ChildScopeVerifier canAccessChild,
  required void Function(String route) navigate,
}) async {
  try {
    final user = auth.user;
    if (!identical(readAuth(), auth) ||
        auth.status != AuthStatus.authenticated ||
        user == null ||
        user.mustChangePassword ||
        user.tenantId == null) {
      return;
    }
    final route = await PushDeepLinkResolver.resolve(
      payload: payload,
      role: user.role,
      tenantId: user.tenantId!,
      canAccessChild: canAccessChild,
    );
    if (route != null && identical(readAuth(), auth)) navigate(route);
  } catch (_) {
    // Stay on the safe screen; never render provider errors or preview data.
  }
}

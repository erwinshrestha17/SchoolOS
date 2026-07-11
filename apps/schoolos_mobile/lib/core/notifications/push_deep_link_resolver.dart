import '../../app/constants/app_routes.dart';
import '../auth/mobile_role.dart';

typedef ChildScopeVerifier = Future<bool> Function(String childId);

class PushDeepLinkResolver {
  const PushDeepLinkResolver._();

  static Future<String?> resolve({
    required Map<String, dynamic> payload,
    required String role,
    required String tenantId,
    required ChildScopeVerifier canAccessChild,
  }) async {
    final payloadTenantId = payload['tenantId'] as String?;
    final rawRoute = payload['route'] as String?;
    if (payloadTenantId == null ||
        payloadTenantId != tenantId ||
        rawRoute == null ||
        !rawRoute.startsWith('/')) {
      return null;
    }

    final uri = Uri.tryParse(rawRoute);
    if (uri == null ||
        uri.hasScheme ||
        uri.hasAuthority ||
        uri.fragment.isNotEmpty ||
        uri.query.isNotEmpty) {
      return null;
    }

    final normalizedRole = MobileRole.normalize(role);
    return switch (normalizedRole) {
      MobileRole.parent => _resolveParent(
        uri.path,
        payload['childId'] as String?,
        canAccessChild,
      ),
      MobileRole.teacher => _exactMatch(uri.path, _teacherRoutes),
      MobileRole.principal => _exactMatch(uri.path, _principalRoutes),
      MobileRole.admin => _exactMatch(uri.path, _adminRoutes),
      MobileRole.driver => _exactMatch(uri.path, _driverRoutes),
      MobileRole.staff => _exactMatch(uri.path, _staffRoutes),
      _ => null,
    };
  }

  static Future<String?> _resolveParent(
    String route,
    String? childId,
    ChildScopeVerifier canAccessChild,
  ) async {
    if (_isSafeNoticeRoute(route)) {
      return route;
    }

    if (childId == null || childId.trim().isEmpty) {
      return null;
    }
    if (!await canAccessChild(childId)) {
      return null;
    }

    final childScopedRoutes = <String>{
      AppRoutes.parentHomework,
      AppRoutes.parentUpdates,
      AppRoutes.parentReportCards,
      AppRoutes.parentFeesReceipts,
      AppRoutes.parentActivity,
      AppRoutes.parentTransport,
      AppRoutes.parentChildAttendanceDetail(childId),
    };

    return childScopedRoutes.contains(route) ? route : null;
  }

  static String? _exactMatch(String route, Set<String> allowed) {
    return allowed.contains(route) ? route : null;
  }

  static bool _isSafeNoticeRoute(String route) {
    final segments = Uri.parse(route).pathSegments;
    return segments.length == 2 &&
        segments.first == 'notices' &&
        segments.last.trim().isNotEmpty;
  }
}

const _teacherRoutes = {
  AppRoutes.teacherHome,
  AppRoutes.teacherAttendance,
  AppRoutes.teacherHomework,
  AppRoutes.teacherTimetable,
};

const _principalRoutes = {
  AppRoutes.principalAttention,
  AppRoutes.principalApprovals,
  AppRoutes.principalNotices,
  AppRoutes.principalAttendanceRisk,
  AppRoutes.principalFees,
  AppRoutes.principalAcademics,
  AppRoutes.principalTransport,
};

const _adminRoutes = {AppRoutes.adminHome, ..._principalRoutes};

const _driverRoutes = {AppRoutes.driverHome, AppRoutes.driverRoute};

const _staffRoutes = {
  AppRoutes.staffHome,
  AppRoutes.staffAttendance,
  AppRoutes.staffLeave,
  AppRoutes.staffPayslips,
};

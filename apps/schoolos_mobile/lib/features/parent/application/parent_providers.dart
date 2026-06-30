import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/connectivity_provider.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/storage/app_preferences_service.dart';
import '../../../core/storage/private_read_cache.dart';
import '../../../core/auth/auth_provider.dart';
import '../data/parent_repository.dart';
import '../domain/parent_models.dart';

final parentRepositoryProvider = Provider<ParentRepository>((ref) {
  return ParentRepository(
    ref.watch(apiClientProvider),
    cache: ref.watch(privateReadCacheProvider),
  );
});

final parentControllerProvider =
    StateNotifierProvider.autoDispose<ParentController, ParentState>((ref) {
      return ParentController(
        repository: ref.watch(parentRepositoryProvider),
        preferences: ref.watch(appPreferencesServiceProvider),
        isOnline: ref.watch(connectivityProvider),
      );
    });

final parentHomeworkProvider = FutureProvider.autoDispose
    .family<List<ParentHomeworkItem>, String>((ref, childId) {
      return ref.watch(parentRepositoryProvider).getHomeworkForChild(childId);
    });

final parentDashboardSummaryProvider = FutureProvider.autoDispose
    .family<ParentDashboardSummary, String>((ref, childId) {
      return ref
          .watch(parentRepositoryProvider)
          .getParentDashboardSummary(childId);
    });

final parentChildProfileProvider = FutureProvider.autoDispose
    .family<ChildProfile, String>((ref, childId) {
      return ref.watch(parentRepositoryProvider).getChildProfile(childId);
    });

final parentTimetableProvider = FutureProvider.autoDispose
    .family<ParentTimetable, String>((ref, childId) {
      return ref.watch(parentRepositoryProvider).getTimetableForChild(childId);
    });

final parentExamScheduleProvider = FutureProvider.autoDispose
    .family<ParentExamSchedule, String>((ref, childId) {
      return ref
          .watch(parentRepositoryProvider)
          .getExamScheduleForChild(childId);
    });

final parentReportCardsProvider = FutureProvider.autoDispose
    .family<List<ParentReportCard>, String>((ref, childId) {
      return ref
          .watch(parentRepositoryProvider)
          .getReportCardsForChild(childId);
    });

final parentPaymentGatewayReadinessProvider = FutureProvider.autoDispose
    .family<ParentPaymentGatewayReadiness, String>((ref, childId) {
      return ref
          .watch(parentRepositoryProvider)
          .getPaymentGatewayReadiness(childId);
    });

final parentConsentStatusProvider =
    FutureProvider.autoDispose<List<ParentConsentStatus>>((ref) {
      return ref.watch(parentRepositoryProvider).getMyConsentStatus();
    });

final parentHomeworkAttachmentsProvider = FutureProvider.autoDispose
    .family<
      List<ParentHomeworkAttachment>,
      ({String childId, String homeworkId})
    >((ref, query) {
      return ref
          .watch(parentRepositoryProvider)
          .getHomeworkAttachments(
            childId: query.childId,
            homeworkId: query.homeworkId,
          );
    });

final parentActivityFeedProvider = FutureProvider.autoDispose
    .family<List<ParentActivityItem>, String>((ref, childId) {
      return ref
          .watch(parentRepositoryProvider)
          .getActivityFeedForChild(childId);
    });

final parentActivityPreviewProvider = FutureProvider.autoDispose
    .family<Uint8List, String>((ref, previewPath) {
      return ref
          .watch(parentRepositoryProvider)
          .getActivityPreview(previewPath);
    });

final parentTransportProvider = FutureProvider.autoDispose
    .family<ParentTransportInfo, String>((ref, childId) {
      return ref.watch(parentRepositoryProvider).getTransportForChild(childId);
    });

final parentCanteenProvider = FutureProvider.autoDispose
    .family<ParentCanteenInfo, String>((ref, childId) {
      return ref.watch(parentRepositoryProvider).getCanteenForChild(childId);
    });

final parentLibraryProvider = FutureProvider.autoDispose
    .family<ParentLibraryInfo, String>((ref, childId) {
      return ref.watch(parentRepositoryProvider).getLibraryForChild(childId);
    });

final parentTeacherThreadsProvider = FutureProvider.autoDispose
    .family<ParentTeacherThreadPage, String?>((ref, childId) {
      return ref
          .watch(parentRepositoryProvider)
          .getParentTeacherThreads(childId: childId);
    });

final parentTeacherMessagesProvider = FutureProvider.autoDispose
    .family<List<ParentTeacherMessage>, String>((ref, threadId) {
      return ref
          .watch(parentRepositoryProvider)
          .getParentTeacherMessages(threadId);
    });

class ParentState {
  const ParentState({
    this.status = ParentDataStatus.loading,
    this.children = const [],
    this.selectedChildId,
    this.dashboard,
    this.profile,
    this.message,
    this.lastUpdated,
    this.isOffline = false,
  });

  final ParentDataStatus status;
  final List<GuardianChild> children;
  final String? selectedChildId;
  final ParentDashboardSummary? dashboard;
  final ChildProfile? profile;
  final String? message;
  final DateTime? lastUpdated;
  final bool isOffline;

  GuardianChild? get selectedChild {
    if (children.isEmpty) {
      return null;
    }
    return children.firstWhere(
      (child) => child.id == selectedChildId,
      orElse: () => children.first,
    );
  }

  ParentState copyWith({
    ParentDataStatus? status,
    List<GuardianChild>? children,
    String? selectedChildId,
    ParentDashboardSummary? dashboard,
    ChildProfile? profile,
    String? message,
    DateTime? lastUpdated,
    bool? isOffline,
    bool clearSelectedChild = false,
    bool clearDashboard = false,
    bool clearProfile = false,
    bool clearMessage = false,
  }) {
    return ParentState(
      status: status ?? this.status,
      children: children ?? this.children,
      selectedChildId: clearSelectedChild
          ? null
          : selectedChildId ?? this.selectedChildId,
      dashboard: clearDashboard ? null : dashboard ?? this.dashboard,
      profile: clearProfile ? null : profile ?? this.profile,
      message: clearMessage ? null : message ?? this.message,
      lastUpdated: lastUpdated ?? this.lastUpdated,
      isOffline: isOffline ?? this.isOffline,
    );
  }
}

class ParentController extends StateNotifier<ParentState> {
  ParentController({
    required this._repository,
    required this._preferences,
    required bool isOnline,
  }) : _isOnline = isOnline,
       super(ParentState(isOffline: !isOnline)) {
    load();
  }

  final ParentRepository _repository;
  final AppPreferencesService _preferences;
  final bool _isOnline;
  int _loadGeneration = 0;

  Future<void> load({String? childId}) async {
    final generation = ++_loadGeneration;
    state = state.copyWith(
      status: ParentDataStatus.loading,
      selectedChildId: childId,
      clearDashboard: true,
      clearProfile: true,
      clearMessage: true,
      isOffline: !_isOnline,
    );

    try {
      final children = await _repository.getGuardianChildren();
      if (generation != _loadGeneration) return;
      if (children.isEmpty) {
        state = ParentState(
          status: ParentDataStatus.empty,
          children: children,
          isOffline: !_isOnline,
          message: 'No children are linked to this guardian account yet.',
        );
        return;
      }

      final savedChildId = childId ?? _preferences.getSelectedChildId();
      final selectedChildId = children.any((child) => child.id == savedChildId)
          ? savedChildId!
          : children.first.id;
      final selectedChild = children.firstWhere(
        (child) => child.id == selectedChildId,
        orElse: () => children.first,
      );

      await _preferences.saveSelectedChildId(selectedChildId);
      if (generation != _loadGeneration) return;
      final dashboard = await _repository.getParentDashboardSummaryForChild(
        selectedChild,
      );
      if (generation != _loadGeneration) return;
      final profile = await _repository.getChildProfileForChild(selectedChild);
      if (generation != _loadGeneration) return;

      state = ParentState(
        status: ParentDataStatus.success,
        children: children,
        selectedChildId: selectedChildId,
        dashboard: dashboard,
        profile: profile,
        lastUpdated: dashboard.lastUpdated,
        isOffline: !_isOnline || dashboard.fromCache,
        message: _isOnline && !dashboard.fromCache
            ? null
            : 'You are offline. Showing last saved parent data.',
      );
    } catch (error) {
      if (generation != _loadGeneration) return;
      final status = switch (error) {
        ModuleLockedException() => ParentDataStatus.moduleLocked,
        PermissionException() => ParentDataStatus.forbidden,
        AuthException() => ParentDataStatus.sessionExpired,
        TimeoutException() => ParentDataStatus.timeout,
        NetworkException() => ParentDataStatus.offline,
        _ => ParentDataStatus.error,
      };
      state = state.copyWith(
        status: status,
        isOffline: error is NetworkException,
        message: error is AppException
            ? error.message
            : 'Could not load parent dashboard. Please try again.',
      );
    }
  }

  Future<void> selectChild(String childId) async {
    await load(childId: childId);
  }
}

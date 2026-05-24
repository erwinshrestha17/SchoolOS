import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/connectivity_provider.dart';
import '../../../core/storage/app_preferences_service.dart';
import '../data/parent_repository.dart';
import '../domain/parent_models.dart';

final parentRepositoryProvider = Provider<ParentRepository>((ref) {
  return const ParentRepository();
});

final parentControllerProvider =
    StateNotifierProvider<ParentController, ParentState>((ref) {
      return ParentController(
        repository: ref.watch(parentRepositoryProvider),
        preferences: ref.watch(appPreferencesServiceProvider),
        isOnline: ref.watch(connectivityProvider),
      );
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
  }) {
    return ParentState(
      status: status ?? this.status,
      children: children ?? this.children,
      selectedChildId: selectedChildId ?? this.selectedChildId,
      dashboard: dashboard ?? this.dashboard,
      profile: profile ?? this.profile,
      message: message ?? this.message,
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

  Future<void> load({String? childId}) async {
    state = state.copyWith(
      status: ParentDataStatus.loading,
      isOffline: !_isOnline,
      message: null,
    );

    try {
      final children = await _repository.getGuardianChildren();
      if (children.isEmpty) {
        state = state.copyWith(
          status: ParentDataStatus.empty,
          children: children,
          message: 'No children are linked to this guardian account yet.',
        );
        return;
      }

      final savedChildId = childId ?? _preferences.getSelectedChildId();
      final selectedChildId = children.any((child) => child.id == savedChildId)
          ? savedChildId!
          : children.first.id;

      await _preferences.saveSelectedChildId(selectedChildId);
      final dashboard = await _repository.getParentDashboardSummary(
        selectedChildId,
      );
      final profile = await _repository.getChildProfile(selectedChildId);

      state = ParentState(
        status: _isOnline ? ParentDataStatus.success : ParentDataStatus.offline,
        children: children,
        selectedChildId: selectedChildId,
        dashboard: dashboard,
        profile: profile,
        lastUpdated: dashboard.lastUpdated,
        isOffline: !_isOnline,
        message: _isOnline
            ? null
            : 'You are offline. Showing last saved parent data.',
      );
    } catch (_) {
      state = state.copyWith(
        status: ParentDataStatus.error,
        message: 'Could not load parent dashboard. Please try again.',
      );
    }
  }

  Future<void> selectChild(String childId) async {
    await _preferences.saveSelectedChildId(childId);
    await load(childId: childId);
  }
}

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_provider.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/network/connectivity_provider.dart';
import '../../../core/storage/private_read_cache.dart';
import '../data/notices_repository.dart';
import '../domain/notice_models.dart';

final noticesRepositoryProvider = Provider<NoticesRepository>((ref) {
  return NoticesRepository(
    ref.watch(apiClientProvider),
    cache: ref.watch(privateReadCacheProvider),
  );
});

final noticesControllerProvider =
    StateNotifierProvider.autoDispose<NoticesController, NoticesState>((ref) {
      return NoticesController(
        repository: ref.watch(noticesRepositoryProvider),
        isOnline: ref.watch(connectivityProvider),
      );
    });

final noticeDetailProvider = FutureProvider.autoDispose.family<Notice, String>((
  ref,
  noticeId,
) async {
  final repository = ref.watch(noticesRepositoryProvider);
  final notice = await repository.getNoticeDetail(noticeId);
  try {
    await repository.markNoticeRead(noticeId);
  } on AppException catch (error) {
    if (error is! NetworkException && error is! TimeoutException) rethrow;
  }
  return notice.copyWith(isRead: true);
});

final notificationCenterProvider =
    FutureProvider.autoDispose<List<NotificationItem>>((ref) async {
      return ref.watch(noticesRepositoryProvider).getNotificationCenter();
    });

class NoticesState {
  const NoticesState({
    this.isLoading = true,
    this.notices = const [],
    this.filter = NoticeFilter.all,
    this.message,
    this.isOffline = false,
    this.lastUpdated,
    this.error,
  });

  final bool isLoading;
  final List<Notice> notices;
  final NoticeFilter filter;
  final String? message;
  final bool isOffline;
  final DateTime? lastUpdated;
  final Object? error;

  List<Notice> get visibleNotices {
    final sorted = [...notices]
      ..sort((a, b) {
        if (a.isRead != b.isRead) {
          return a.isRead ? 1 : -1;
        }
        return b.publishedAt.compareTo(a.publishedAt);
      });

    return sorted.where((notice) {
      switch (filter) {
        case NoticeFilter.all:
          return true;
        case NoticeFilter.unread:
          return !notice.isRead;
        case NoticeFilter.important:
          return notice.isImportant;
        case NoticeFilter.emergency:
          return notice.isEmergency;
      }
    }).toList();
  }

  NoticesState copyWith({
    bool? isLoading,
    List<Notice>? notices,
    NoticeFilter? filter,
    String? message,
    bool? isOffline,
    DateTime? lastUpdated,
    Object? error,
  }) {
    return NoticesState(
      isLoading: isLoading ?? this.isLoading,
      notices: notices ?? this.notices,
      filter: filter ?? this.filter,
      message: message ?? this.message,
      isOffline: isOffline ?? this.isOffline,
      lastUpdated: lastUpdated ?? this.lastUpdated,
      error: error,
    );
  }
}

enum NoticeFilter { all, unread, important, emergency }

class NoticesController extends StateNotifier<NoticesState> {
  NoticesController({required this._repository, required bool isOnline})
    : _isOnline = isOnline,
      super(NoticesState(isOffline: !isOnline)) {
    load();
  }

  final NoticesRepository _repository;
  final bool _isOnline;

  Future<void> load() async {
    state = state.copyWith(
      isLoading: true,
      isOffline: !_isOnline,
      message: null,
    );
    try {
      final feed = await _repository.getNoticeFeed();
      state = state.copyWith(
        isLoading: false,
        notices: feed.items,
        lastUpdated: feed.lastUpdated,
        isOffline: !_isOnline || feed.fromCache,
        message: !_isOnline || feed.fromCache
            ? 'You are offline. Showing last saved notices.'
            : null,
      );
    } catch (error) {
      state = state.copyWith(
        isLoading: false,
        error: error,
        message: error is AppException
            ? error.message
            : 'Could not load notices. Please try again.',
      );
    }
  }

  void setFilter(NoticeFilter filter) {
    state = state.copyWith(filter: filter);
  }
}

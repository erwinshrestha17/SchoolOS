import 'package:flutter_riverpod/flutter_riverpod.dart';

class ParentFeatureState {
  const ParentFeatureState({this.noticeRead = false});

  final bool noticeRead;

  ParentFeatureState copyWith({bool? noticeRead}) {
    return ParentFeatureState(noticeRead: noticeRead ?? this.noticeRead);
  }
}

class ParentFeatureController extends StateNotifier<ParentFeatureState> {
  ParentFeatureController() : super(const ParentFeatureState());

  void markNoticeRead() => state = state.copyWith(noticeRead: true);
}

final parentFeatureControllerProvider =
    StateNotifierProvider<ParentFeatureController, ParentFeatureState>(
      (ref) => ParentFeatureController(),
    );

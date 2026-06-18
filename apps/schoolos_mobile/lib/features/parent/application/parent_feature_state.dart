import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/parent_feature_models.dart';

class ParentFeatureState {
  const ParentFeatureState({
    this.invoicePaid = false,
    this.noticeRead = false,
    this.walletBalance = 620,
    this.lowBalanceReminder = 200,
    this.walletTransactions = const [
      WalletTransaction(
        title: 'Milk & Sandwich',
        amount: -80,
        time: 'Today, 12:45 PM',
      ),
      WalletTransaction(
        title: 'Juice',
        amount: -50,
        time: 'Yesterday, 1:15 PM',
      ),
      WalletTransaction(
        title: 'Top-up received',
        amount: 500,
        time: 'Jun 12, 10:00 AM',
      ),
    ],
    this.mediaConsent = true,
    this.communicationConsent = true,
    this.tripDecision,
    this.activityLog = const [],
  });

  final bool invoicePaid;
  final bool noticeRead;
  final int walletBalance;
  final int lowBalanceReminder;
  final List<WalletTransaction> walletTransactions;
  final bool mediaConsent;
  final bool communicationConsent;
  final bool? tripDecision;
  final List<String> activityLog;

  ParentFeatureState copyWith({
    bool? invoicePaid,
    bool? noticeRead,
    int? walletBalance,
    int? lowBalanceReminder,
    List<WalletTransaction>? walletTransactions,
    bool? mediaConsent,
    bool? communicationConsent,
    bool? tripDecision,
    bool clearTripDecision = false,
    List<String>? activityLog,
  }) => ParentFeatureState(
    invoicePaid: invoicePaid ?? this.invoicePaid,
    noticeRead: noticeRead ?? this.noticeRead,
    walletBalance: walletBalance ?? this.walletBalance,
    lowBalanceReminder: lowBalanceReminder ?? this.lowBalanceReminder,
    walletTransactions: walletTransactions ?? this.walletTransactions,
    mediaConsent: mediaConsent ?? this.mediaConsent,
    communicationConsent: communicationConsent ?? this.communicationConsent,
    tripDecision: clearTripDecision ? null : tripDecision ?? this.tripDecision,
    activityLog: activityLog ?? this.activityLog,
  );
}

class ParentFeatureController extends StateNotifier<ParentFeatureState> {
  ParentFeatureController() : super(const ParentFeatureState());

  void markNoticeRead() => state = state.copyWith(noticeRead: true);

  void completePayment() => state = state.copyWith(invoicePaid: true);

  void topUp(int amount) => state = state.copyWith(
    walletBalance: state.walletBalance + amount,
    walletTransactions: [
      WalletTransaction(
        title: 'Top-up received',
        amount: amount,
        time: 'Just now',
      ),
      ...state.walletTransactions,
    ],
  );

  void setLowBalanceReminder(int amount) =>
      state = state.copyWith(lowBalanceReminder: amount);

  void setConsent(String id, bool value) {
    final entry =
        '${id == 'media' ? 'Media' : 'Communication'} consent ${value ? 'approved' : 'withdrawn'}';
    state = state.copyWith(
      mediaConsent: id == 'media' ? value : state.mediaConsent,
      communicationConsent: id == 'communication'
          ? value
          : state.communicationConsent,
      activityLog: [entry, ...state.activityLog],
    );
  }

  void decideTrip(bool approved) => state = state.copyWith(
    tripDecision: approved,
    activityLog: [
      'Trip permission ${approved ? 'approved' : 'declined'}',
      ...state.activityLog,
    ],
  );
}

final parentFeatureControllerProvider =
    StateNotifierProvider<ParentFeatureController, ParentFeatureState>(
      (ref) => ParentFeatureController(),
    );

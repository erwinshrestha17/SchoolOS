import '../storage/token_storage_service.dart';

/// One process-local session fence per credential store, shared by auth and all
/// API clients using that store. The weak association does not retain stores or
/// persist credentials; secure storage remains the only durable token store.
class SessionCredentialCoordinator {
  SessionCredentialCoordinator._();

  static final _instances = Expando<SessionCredentialCoordinator>();

  static SessionCredentialCoordinator forStorage(TokenStorageService storage) =>
      _instances[storage] ??= SessionCredentialCoordinator._();

  int _epoch = 0;
  bool _requestsAllowed = true;
  Future<void> _storageTail = Future<void>.value();

  int get epoch => _epoch;
  bool isCurrent(int epoch) => epoch == _epoch;
  bool allowsRequests(int epoch) => isCurrent(epoch) && _requestsAllowed;

  /// Invalidates in-flight work synchronously, before network or storage waits.
  int beginTransition() {
    _requestsAllowed = false;
    return ++_epoch;
  }

  void allowRequests(int epoch) {
    if (isCurrent(epoch)) _requestsAllowed = true;
  }

  bool expire(int epoch) {
    if (!allowsRequests(epoch)) return false;
    beginTransition();
    return true;
  }

  /// Refresh, account replacement and logout writes cannot interleave. Reads
  /// used to authorize requests also wait here, so a half-written pair is never
  /// attached to a request. An older write may finish, but the next transition
  /// clears/replaces it before requests can resume.
  Future<T> withStorage<T>(Future<T> Function() operation) {
    final result = _storageTail.then((_) => operation());
    _storageTail = result.then<void>(
      (_) {},
      onError: (Object _, StackTrace _) {},
    );
    return result;
  }
}

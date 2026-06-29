import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/auth/models/auth_user.dart';
import 'package:schoolos_mobile/core/auth/models/login_request.dart';
import 'package:schoolos_mobile/core/errors/app_exception.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/network/interceptors/token_refresh_interceptor.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';
import 'package:schoolos_mobile/core/storage/secure_storage_service.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockTokenStorageService extends Mock implements TokenStorageService {}

class MockSecureStorageService extends Mock implements SecureStorageService {}

class MockDio extends Mock implements Dio {}

class MockErrorInterceptorHandler extends Mock
    implements ErrorInterceptorHandler {}

// Fallback values for mocktail
class FakeRequestOptions extends Fake implements RequestOptions {}

class FakeResponse<T> extends Fake implements Response<T> {}

class FakeDioException extends Fake implements DioException {}

void main() {
  setUpAll(() {
    registerFallbackValue(FakeRequestOptions());
    registerFallbackValue(FakeDioException());
  });

  group('AuthRepository Tests', () {
    late MockApiClient mockApiClient;
    late AuthRepository repository;

    setUp(() {
      mockApiClient = MockApiClient();
      repository = AuthRepository(mockApiClient);
    });

    test('login returns LoginResponse on successful HTTP request', () async {
      final mockResponse = Response(
        requestOptions: RequestOptions(path: '/auth/login'),
        statusCode: 200,
        data: {
          'tokens': {
            'accessToken': 'access_token_123',
            'refreshToken': 'refresh_token_123',
          },
          'user': {
            'id': 'user_id_123',
            'tenantId': 'tenant_123',
            'tenantSlug': 'test',
            'name': 'Test User',
            'email': 'test@school.edu',
            'roles': ['teacher'],
            'permissions': ['attendance:read'],
          },
        },
      );

      when(
        () => mockApiClient.post<dynamic>(
          '/auth/login',
          data: any(named: 'data'),
        ),
      ).thenAnswer((_) async => mockResponse);

      final result = await repository.login(
        const LoginRequest(
          tenantSlug: 'test',
          usernameOrEmail: 'test@school.edu',
          password: 'password',
        ),
      );

      expect(result.tokenPair.accessToken, 'access_token_123');
      expect(result.tokenPair.refreshToken, 'refresh_token_123');
      expect(result.user.name, 'Test User');
      expect(result.user.role, 'TEACHER');
      expect(result.user.tenantSlug, 'test');
      expect(result.user.permissions, contains('attendance:read'));
      final loginPayload =
          verify(
                () => mockApiClient.post<dynamic>(
                  '/auth/login',
                  data: captureAny(named: 'data'),
                ),
              ).captured.single
              as Map<String, dynamic>;
      expect(loginPayload, {
        'tenantSlug': 'test',
        'email': 'test@school.edu',
        'password': 'password',
      });
    });

    test(
      'login rejects MFA challenge responses as incomplete sessions',
      () async {
        when(
          () => mockApiClient.post<dynamic>(
            '/auth/login',
            data: any(named: 'data'),
          ),
        ).thenAnswer(
          (_) async => Response(
            requestOptions: RequestOptions(path: '/auth/login'),
            data: {'requiresMfa': true, 'challengeToken': 'challenge'},
          ),
        );

        await expectLater(
          repository.login(
            const LoginRequest(
              tenantSlug: 'test',
              usernameOrEmail: 'test@school.edu',
              password: 'password',
            ),
          ),
          throwsA(isA<MfaRequiredException>()),
        );
      },
    );

    test('getMe returns AuthUser on successful HTTP request', () async {
      final mockResponse = Response(
        requestOptions: RequestOptions(path: '/auth/me'),
        statusCode: 200,
        data: {
          'userId': 'user_id_123',
          'tenantId': 'tenant_123',
          'tenantSlug': 'test',
          'email': 'test@school.edu',
          'roles': ['parent'],
          'staff': {'firstName': 'Test', 'lastName': 'User'},
        },
      );

      when(
        () => mockApiClient.get<dynamic>('/auth/me'),
      ).thenAnswer((_) async => mockResponse);

      final result = await repository.getMe();

      expect(result.name, 'Test User');
      expect(result.id, 'user_id_123');
      expect(result.role, 'PARENT');
      expect(result.tenantId, 'tenant_123');
    });

    test('maps backend staff and teacher role names to mobile workspaces', () {
      final staffUser = AuthUser.fromJson({
        'userId': 'staff-1',
        'email': 'accountant@schoolos.com',
        'roles': ['accountant'],
      });
      final teacherUser = AuthUser.fromJson({
        'userId': 'teacher-1',
        'email': 'subjectteacher@schoolos.com',
        'roles': ['subject_teacher'],
      });
      final principalUser = AuthUser.fromJson({
        'userId': 'principal-1',
        'email': 'principal@schoolos.com',
        'roles': ['principal'],
      });

      expect(staffUser.role, 'STAFF');
      expect(teacherUser.role, 'TEACHER');
      expect(principalUser.role, 'PRINCIPAL');
    });

    test('reads tenant metadata from nested auth profile responses', () {
      final user = AuthUser.fromJson({
        'userId': 'user-1',
        'email': 'principal@schoolos.com',
        'roles': ['principal'],
        'tenant': {'id': 'tenant-1', 'slug': 'default-school'},
      });

      expect(user.role, 'PRINCIPAL');
      expect(user.tenantId, 'tenant-1');
      expect(user.tenantSlug, 'default-school');
    });

    test('refreshToken returns TokenPair on successful HTTP request', () async {
      final mockResponse = Response(
        requestOptions: RequestOptions(path: '/auth/refresh'),
        statusCode: 200,
        data: {
          'accessToken': 'new_access_token',
          'refreshToken': 'new_refresh_token',
        },
      );

      when(
        () => mockApiClient.post<dynamic>(
          '/auth/refresh',
          data: any(named: 'data'),
        ),
      ).thenAnswer((_) async => mockResponse);

      final result = await repository.refreshToken('old_refresh_token');

      expect(result.accessToken, 'new_access_token');
      expect(result.refreshToken, 'new_refresh_token');
    });

    test('logout calls correct endpoint', () async {
      final mockResponse = Response(
        requestOptions: RequestOptions(path: '/auth/logout'),
        statusCode: 200,
      );

      when(
        () => mockApiClient.post<dynamic>(
          '/auth/logout',
          data: {
            'refreshToken': 'refresh_token_123',
            'installationId': '3b53ee2c-f356-477d-8b2c-7a35918590ab',
          },
        ),
      ).thenAnswer((_) async => mockResponse);

      await repository.logout(
        refreshToken: 'refresh_token_123',
        installationId: '3b53ee2c-f356-477d-8b2c-7a35918590ab',
      );

      verify(
        () => mockApiClient.post<dynamic>(
          '/auth/logout',
          data: {
            'refreshToken': 'refresh_token_123',
            'installationId': '3b53ee2c-f356-477d-8b2c-7a35918590ab',
          },
        ),
      ).called(1);
    });
    group('TokenRefreshInterceptor Tests', () {
      late MockTokenStorageService mockTokenStorage;
      late MockDio mockDio;
      late MockErrorInterceptorHandler mockHandler;
      late bool onSessionExpiredCalled;
      late TokenRefreshInterceptor interceptor;

      setUp(() {
        mockTokenStorage = MockTokenStorageService();
        mockDio = MockDio();
        mockHandler = MockErrorInterceptorHandler();
        onSessionExpiredCalled = false;

        interceptor = TokenRefreshInterceptor(
          tokenStorage: mockTokenStorage,
          dio: mockDio,
          onSessionExpired: () {
            onSessionExpiredCalled = true;
          },
        );
      });

      test('does not intercept when status code is not 401', () async {
        final requestOptions = RequestOptions(path: '/some-endpoint');
        final response = Response(
          requestOptions: requestOptions,
          statusCode: 400,
        );
        final dioException = DioException(
          requestOptions: requestOptions,
          response: response,
        );

        when(() => mockHandler.next(any())).thenAnswer((_) {});

        await interceptor.onError(dioException, mockHandler);

        verify(() => mockHandler.next(dioException)).called(1);
        expect(onSessionExpiredCalled, isFalse);
      });

      test(
        'does not intercept if request options is a retry to avoid infinite loop',
        () async {
          final requestOptions = RequestOptions(
            path: '/some-endpoint',
            extra: {'isRetry': true},
          );
          final response = Response(
            requestOptions: requestOptions,
            statusCode: 401,
          );
          final dioException = DioException(
            requestOptions: requestOptions,
            response: response,
          );

          when(() => mockHandler.next(any())).thenAnswer((_) {});

          await interceptor.onError(dioException, mockHandler);

          verify(() => mockHandler.next(dioException)).called(1);
          expect(onSessionExpiredCalled, isFalse);
        },
      );

      test(
        'calls onSessionExpired and passes exception when refresh token is empty',
        () async {
          final requestOptions = RequestOptions(path: '/some-endpoint');
          final response = Response(
            requestOptions: requestOptions,
            statusCode: 401,
          );
          final dioException = DioException(
            requestOptions: requestOptions,
            response: response,
          );

          when(
            () => mockTokenStorage.getRefreshToken(),
          ).thenAnswer((_) async => null);
          when(() => mockHandler.next(any())).thenAnswer((_) {});

          await interceptor.onError(dioException, mockHandler);

          verify(() => mockTokenStorage.getRefreshToken()).called(1);
          verify(() => mockHandler.next(dioException)).called(1);
          expect(onSessionExpiredCalled, isTrue);
        },
      );
    });
  });

  test('treats malformed and expired access tokens as invalid sessions', () {
    final storage = TokenStorageService(MockSecureStorageService());
    final now = DateTime.utc(2026, 6, 18, 12);
    final validToken = _jwt(exp: now.add(const Duration(minutes: 5)));
    final expiredToken = _jwt(exp: now.subtract(const Duration(minutes: 1)));

    expect(storage.isAccessTokenExpired(validToken, now: now), isFalse);
    expect(storage.isAccessTokenExpired(expiredToken, now: now), isTrue);
    expect(storage.isAccessTokenExpired('not-a-jwt', now: now), isTrue);
  });
}

String _jwt({required DateTime exp}) {
  final header = base64Url.encode(utf8.encode(jsonEncode({'alg': 'HS256'})));
  final payload = base64Url.encode(
    utf8.encode(jsonEncode({'exp': exp.millisecondsSinceEpoch ~/ 1000})),
  );
  return '$header.$payload.signature';
}

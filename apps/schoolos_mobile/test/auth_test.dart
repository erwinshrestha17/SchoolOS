import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/auth/data/auth_repository.dart';
import 'package:schoolos_mobile/core/auth/models/login_request.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/core/network/interceptors/token_refresh_interceptor.dart';
import 'package:schoolos_mobile/core/storage/token_storage_service.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockTokenStorageService extends Mock implements TokenStorageService {}

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
            'name': 'Test User',
            'email': 'test@school.edu',
            'role': 'TEACHER',
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
          tenantCode: 'test',
          usernameOrEmail: 'test@school.edu',
          password: 'password',
        ),
      );

      expect(result.tokenPair.accessToken, 'access_token_123');
      expect(result.tokenPair.refreshToken, 'refresh_token_123');
      expect(result.user.name, 'Test User');
      expect(result.user.role, 'TEACHER');
    });

    test('getMe returns AuthUser on successful HTTP request', () async {
      final mockResponse = Response(
        requestOptions: RequestOptions(path: '/auth/me'),
        statusCode: 200,
        data: {
          'id': 'user_id_123',
          'name': 'Test User',
          'email': 'test@school.edu',
          'role': 'PARENT',
        },
      );

      when(
        () => mockApiClient.get<dynamic>('/auth/me'),
      ).thenAnswer((_) async => mockResponse);

      final result = await repository.getMe();

      expect(result.name, 'Test User');
      expect(result.role, 'PARENT');
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
        () => mockApiClient.post<dynamic>('/auth/logout'),
      ).thenAnswer((_) async => mockResponse);

      await repository.logout();

      verify(() => mockApiClient.post<dynamic>('/auth/logout')).called(1);
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
}

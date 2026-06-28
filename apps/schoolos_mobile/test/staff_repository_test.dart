import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schoolos_mobile/core/network/api_client.dart';
import 'package:schoolos_mobile/features/staff/data/staff_repository.dart';
import 'package:schoolos_mobile/features/staff/domain/staff_models.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('StaffRepository', () {
    late MockApiClient apiClient;
    late StaffRepository repository;
    late Directory tempDir;

    setUp(() {
      apiClient = MockApiClient();
      repository = StaffRepository(apiClient);
      tempDir = Directory.systemTemp.createTempSync('schoolos_staff_test_');
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('plugins.flutter.io/path_provider'),
            (call) async {
              if (call.method == 'getApplicationDocumentsDirectory') {
                return tempDir.path;
              }
              if (call.method == 'getTemporaryDirectory') {
                return tempDir.path;
              }
              return null;
            },
          );
    });

    tearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('plugins.flutter.io/path_provider'),
            null,
          );
      if (tempDir.existsSync()) {
        tempDir.deleteSync(recursive: true);
      }
    });

    test('loads staff profile from staff self-service endpoint', () async {
      when(() => apiClient.get<dynamic>('/staff/me')).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/staff/me'),
          data: {
            'id': 'staff-1',
            'employeeId': 'EMP-0001',
            'firstName': 'Hari',
            'lastName': 'Devkota',
            'department': 'Accounts',
            'designation': 'Accountant',
            'user': {'email': 'accountant@schoolos.com'},
          },
        ),
      );

      final profile = await repository.getProfile();

      expect(profile.id, 'staff-1');
      expect(profile.employeeId, 'EMP-0001');
      expect(profile.name, 'Hari Devkota');
      expect(profile.email, 'accountant@schoolos.com');
      expect(profile.department, 'Accounts');
    });

    test('loads staff attendance, leave requests, and payslips', () async {
      when(
        () => apiClient.get<dynamic>('/attendance/me/attendance'),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/attendance/me/attendance'),
          data: [
            {
              'id': 'att-1',
              'attendanceDate': '2026-05-31T00:00:00.000Z',
              'status': 'PRESENT',
              'checkInAt': '2026-05-31T03:45:00.000Z',
            },
          ],
        ),
      );
      when(
        () => apiClient.get<dynamic>('/attendance/me/leave-requests'),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/attendance/me/leave-requests'),
          data: [
            {
              'id': 'leave-1',
              'leaveType': 'CASUAL',
              'startsOn': '2026-06-03T00:00:00.000Z',
              'endsOn': '2026-06-04T00:00:00.000Z',
              'days': '2',
              'reason': 'Family work',
              'status': 'PENDING',
            },
          ],
        ),
      );
      when(() => apiClient.get<dynamic>('/payroll/me/payslips')).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/payroll/me/payslips'),
          data: [
            {
              'id': 'pay-1',
              'payslipNumber': 'PAY-2026-05-001',
              'status': 'ISSUED',
              'paymentStatus': 'PAID',
              'grossSalary': '45000',
              'deductionAmount': '5000',
              'netSalary': '40000',
              'payrollRun': {'periodMonth': 5, 'periodYear': 2026},
            },
          ],
        ),
      );

      final attendance = await repository.getAttendance();
      final leaveRequests = await repository.getLeaveRequests();
      final payslips = await repository.getPayslips();

      expect(attendance.single.status, 'PRESENT');
      expect(leaveRequests.single.days, 2);
      expect(payslips.single.periodLabel, 'May 2026');
      expect(payslips.single.netSalary, 40000);
    });

    test('downloads staff payslip PDF from staff-readable endpoint', () async {
      const payslip = StaffPayslip(
        id: 'pay-1',
        payslipNumber: 'PAY/2026/05',
        periodLabel: 'May 2026',
        status: 'ISSUED',
        paymentStatus: 'PAID',
        grossSalary: 45000,
        deductionAmount: 5000,
        netSalary: 40000,
      );

      when(
        () => apiClient.get<List<int>>(
          '/payroll/me/payslips/PAY%2F2026%2F05.pdf',
          options: any(named: 'options'),
        ),
      ).thenAnswer(
        (_) async => Response<List<int>>(
          requestOptions: RequestOptions(
            path: '/payroll/me/payslips/PAY%2F2026%2F05.pdf',
          ),
          data: [37, 80, 68, 70],
        ),
      );

      final download = await repository.downloadPayslipPdf(payslip);

      expect(download.fileName, 'PAY-2026-05.pdf');
      expect(download.filePath, contains('/schoolos/payslips/'));
      expect(File(download.filePath).existsSync(), isTrue);
      expect(File(download.filePath).readAsBytesSync(), [37, 80, 68, 70]);
      verify(
        () => apiClient.get<List<int>>(
          '/payroll/me/payslips/PAY%2F2026%2F05.pdf',
          options: any(named: 'options'),
        ),
      ).called(1);
    });
  });

  test('StaffPayslip maps missing payroll period defensively', () {
    final payslip = StaffPayslip.fromJson({
      'id': 'pay-2',
      'grossSalary': 1000,
      'deductionAmount': 100,
      'netSalary': 900,
    });

    expect(payslip.periodLabel, 'Payroll period');
    expect(payslip.status, 'DRAFT');
  });
}

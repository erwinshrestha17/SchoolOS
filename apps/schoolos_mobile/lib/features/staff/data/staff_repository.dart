import 'dart:io';

import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/network/api_client.dart';
import '../domain/staff_models.dart';

class StaffRepository {
  const StaffRepository(this._client);

  final ApiClient _client;

  Future<StaffProfile> getProfile() async {
    final response = await _client.get('/staff/me');
    return StaffProfile.fromJson(response.data as Map<String, dynamic>);
  }

  Future<List<StaffAttendanceRecord>> getAttendance() async {
    final response = await _client.get('/attendance/me/attendance');
    return _list(response.data)
        .whereType<Map<String, dynamic>>()
        .map(StaffAttendanceRecord.fromJson)
        .toList();
  }

  Future<List<StaffLeaveRequest>> getLeaveRequests() async {
    final response = await _client.get('/attendance/me/leave-requests');
    return _list(response.data)
        .whereType<Map<String, dynamic>>()
        .map(StaffLeaveRequest.fromJson)
        .toList();
  }

  Future<List<StaffPayslip>> getPayslips() async {
    final response = await _client.get('/payroll/me/payslips');
    return _list(
      response.data,
    ).whereType<Map<String, dynamic>>().map(StaffPayslip.fromJson).toList();
  }

  Future<StaffPayslipPdfDownload> downloadPayslipPdf(
    StaffPayslip payslip,
  ) async {
    if (payslip.payslipNumber.isEmpty) {
      throw StateError('Payslip number is missing.');
    }

    final response = await _client.get<List<int>>(
      '/payroll/me/payslips/${Uri.encodeComponent(payslip.payslipNumber)}.pdf',
      options: Options(
        responseType: ResponseType.bytes,
        headers: {Headers.acceptHeader: 'application/pdf'},
      ),
    );
    final bytes = response.data;
    if (bytes == null || bytes.isEmpty) {
      throw StateError('Payslip PDF was empty.');
    }

    final temporaryDir = await getTemporaryDirectory();
    final payslipDir = Directory('${temporaryDir.path}/schoolos/payslips');
    if (!payslipDir.existsSync()) {
      await payslipDir.create(recursive: true);
    }

    final fileName = '${_safeFileName(payslip.payslipNumber)}.pdf';
    final file = File('${payslipDir.path}/$fileName');
    await file.writeAsBytes(bytes, flush: true);

    return StaffPayslipPdfDownload(
      fileName: fileName,
      filePath: file.path,
      payslip: payslip,
    );
  }

  List<dynamic> _list(Object? value) {
    if (value is List<dynamic>) {
      return value;
    }
    if (value is Map<String, dynamic>) {
      final data = value['data'];
      if (data is List<dynamic>) {
        return data;
      }
      final items = value['items'];
      if (items is List<dynamic>) {
        return items;
      }
    }
    return const [];
  }
}

String _safeFileName(String value) {
  final sanitized = value.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '-');
  return sanitized.isEmpty ? 'payslip' : sanitized;
}

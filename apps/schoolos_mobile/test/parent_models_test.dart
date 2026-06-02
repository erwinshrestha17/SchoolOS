import 'package:flutter_test/flutter_test.dart';
import 'package:schoolos_mobile/features/parent/domain/parent_models.dart';

void main() {
  group('ParentDashboardSummary', () {
    test('maps mobile dashboard data into parent-safe summary values', () {
      const child = GuardianChild(
        id: 'child-1',
        name: 'Asha Rai',
        classSection: 'Grade 4 - A',
        rollNumber: '7',
        academicYear: '2026',
        relationship: 'Daughter',
      );

      final summary = ParentDashboardSummary.fromMobileDashboard({
        'selectedStudent': {
          'id': 'child-1',
          'name': 'Asha Rai',
          'classSection': 'Grade 4 - A',
          'rollNumber': '7',
          'academicYear': '2026',
          'relationship': 'Daughter',
        },
        'attendance': {
          'today': {'label': 'Present today'},
          'monthSummary': {'attendancePercentage': 95.5},
        },
        'homework': {
          'pendingCount': 2,
          'nextDueAt': '2026-06-02T09:00:00.000Z',
        },
        'fees': {
          'totalOutstanding': 175.25,
          'overdueCount': 1,
          'nextDueDate': '2026-06-05T00:00:00.000Z',
          'recentInvoices': [
            {
              'id': 'invoice-1',
              'invoiceNumber': 'INV-001',
              'status': 'PARTIAL',
              'totalAmount': 200,
              'paidAmount': 50,
              'outstandingAmount': 150,
              'isOverdue': true,
              'receipts': [
                {
                  'id': 'receipt-1',
                  'receiptNumber': 'REC-001',
                  'invoiceId': 'invoice-1',
                  'invoiceNumber': 'INV-001',
                  'paymentId': 'payment-1',
                  'amount': 50,
                  'method': 'CASH',
                  'issuedAt': '2026-05-10T00:00:00.000Z',
                },
              ],
            },
          ],
          'recentReceipts': [
            {
              'id': 'receipt-1',
              'receiptNumber': 'REC-001',
              'invoiceId': 'invoice-1',
              'invoiceNumber': 'INV-001',
              'paymentId': 'payment-1',
              'amount': 50,
              'method': 'CASH',
              'issuedAt': '2026-05-10T00:00:00.000Z',
            },
          ],
        },
        'notices': {'unreadCount': 3},
        'transport': {
          'activeTrip': {
            'studentStatus': 'BOARDED',
            'route': {'name': 'Route A'},
          },
        },
        'canteen': {
          'wallet': {'balance': 450, 'isLowBalance': false},
        },
        'latestActivity': {
          'title': 'Sports day',
          'caption': 'Asha joined relay practice.',
        },
      }, child);

      expect(summary.child.name, 'Asha Rai');
      expect(summary.attendanceToday, 'Present today');
      expect(summary.homeworkPending, 2);
      expect(summary.feesDue, 175.25);
      expect(summary.overdueFeesCount, 1);
      expect(summary.recentInvoices.single.invoiceNumber, 'INV-001');
      expect(
        summary.recentInvoices.single.receipts.single.receiptNumber,
        'REC-001',
      );
      expect(summary.recentReceipts.single.amount, 50);
      expect(summary.unreadNotices, 3);
      expect(summary.transportStatus, 'Boarded');
      expect(summary.transportDetail, 'Route A');
      expect(summary.canteenBalance, 450);
      expect(summary.latestActivityTitle, 'Sports day');
    });
  });

  group('ParentHomeworkItem', () {
    test('identifies pending homework from mobile API data', () {
      final item = ParentHomeworkItem.fromJson({
        'id': 'homework-1',
        'title': 'Fractions worksheet',
        'subject': {'name': 'Math'},
        'submissionStatus': 'NOT_SUBMITTED',
        'attachmentCount': 2,
      });

      expect(item.title, 'Fractions worksheet');
      expect(item.subjectName, 'Math');
      expect(item.isPending, isTrue);
      expect(item.attachmentCount, 2);
    });
  });

  test('maps timetable slots from mobile API data', () {
    final timetable = ParentTimetable.fromJson({
      'version': {'name': 'Primary timetable', 'status': 'PUBLISHED'},
      'slots': [
        {
          'id': 'slot-1',
          'dayOfWeek': 1,
          'startsAt': '09:00',
          'endsAt': '09:45',
          'subject': {'name': 'Science'},
          'teacherName': 'Ms. Rana',
          'period': {'name': 'Period 1'},
          'room': 'Lab 1',
        },
      ],
    });

    expect(timetable.versionName, 'Primary timetable');
    expect(timetable.slots.single.subjectName, 'Science');
    expect(timetable.slots.single.teacherName, 'Ms. Rana');
  });

  test('maps transport and canteen module data', () {
    final transport = ParentTransportInfo.fromJson({
      'activeTrip': {
        'status': 'ACTIVE',
        'studentStatus': 'BOARDED',
        'isDelayed': true,
        'delayMinutes': 12,
        'delayReason': 'Traffic',
        'direction': 'PICKUP',
        'route': {'name': 'Route A', 'code': 'R-A'},
        'stop': {'name': 'Gate 2', 'sequence': 3},
        'vehicle': {
          'registrationNumber': 'BA-1-PA-1234',
          'model': 'Bus 3',
          'capacity': 32,
        },
        'latestLocation': {
          'latitude': 27.7101,
          'longitude': 85.3222,
          'speedKph': 18.5,
          'recordedAt': '2026-06-02T07:45:00.000Z',
        },
      },
      'assignment': {'status': 'ACTIVE', 'pickupDirection': 'PICKUP'},
      'enrollment': {'status': 'ACTIVE', 'feeAmount': 1200},
    });
    final canteen = ParentCanteenInfo.fromJson({
      'wallet': {
        'balance': 80,
        'lowBalanceThreshold': 100,
        'isLowBalance': true,
      },
      'activeMealPlans': [
        {
          'mealPlan': {'name': 'Lunch', 'mealType': 'LUNCH'},
        },
      ],
      'recentTransactions': [
        {'type': 'DEBIT', 'amount': 40, 'balanceAfter': 80},
      ],
      'menuItems': [
        {
          'name': 'Veg momo',
          'category': 'SNACK',
          'unitPrice': 80,
          'allergenTags': ['gluten'],
        },
      ],
    });

    expect(transport.routeName, 'Route A');
    expect(transport.routeCode, 'R-A');
    expect(transport.stopSequence, 3);
    expect(transport.vehicleModel, 'Bus 3');
    expect(transport.vehicleCapacity, 32);
    expect(transport.tripDirection, 'PICKUP');
    expect(transport.isDelayed, isTrue);
    expect(transport.delayMinutes, 12);
    expect(transport.delayReason, 'Traffic');
    expect(transport.speedKph, 18.5);
    expect(transport.latitude, 27.7101);
    expect(transport.longitude, 85.3222);
    expect(transport.hasLatestLocation, isTrue);
    expect(transport.feeAmount, 1200);
    expect(canteen.isLowBalance, isTrue);
    expect(canteen.activeMealPlans.single.name, 'Lunch');
    expect(canteen.menuItems.single.allergenTags, ['gluten']);
  });

  test('maps parent teacher chat threads and messages', () {
    final page = ParentTeacherThreadPage.fromJson({
      'total': 1,
      'items': [
        {
          'id': 'thread-1',
          'studentId': 'child-1',
          'status': 'OPEN',
          'student': {
            'firstNameEn': 'Asha',
            'lastNameEn': 'Rai',
            'class': {'name': 'Grade 4'},
            'sectionRef': {'name': 'A'},
          },
          'classTeacher': {'firstName': 'Sita', 'lastName': 'Adhikari'},
          'sla': 'Usually replies within 1 school day.',
          'latestMessages': [
            {
              'id': 'message-1',
              'threadId': 'thread-1',
              'senderUserId': 'guardian-user-1',
              'senderRole': 'PARENT',
              'message': 'Please call me.',
              'priority': 'NORMAL',
              'status': 'SENT',
            },
          ],
        },
      ],
    });

    expect(page.total, 1);
    expect(page.items.single.studentName, 'Asha Rai');
    expect(page.items.single.classSection, 'Grade 4 - A');
    expect(page.items.single.teacherName, 'Sita Adhikari');
    expect(page.items.single.latestMessage?.isParentSender, isTrue);
  });
}

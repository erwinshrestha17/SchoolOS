import 'package:flutter/material.dart';

class ParentProfile {
  const ParentProfile({required this.name, required this.school});
  final String name;
  final String school;
}

class ChildProfile {
  const ChildProfile({
    required this.id,
    required this.name,
    required this.classSection,
    required this.roll,
    required this.teacher,
  });
  final String id;
  final String name;
  final String classSection;
  final int roll;
  final String teacher;
}

class AttendanceRecord {
  const AttendanceRecord(this.day, this.status, this.time);
  final String day;
  final String status;
  final String? time;
}

class HomeworkAssignment {
  const HomeworkAssignment({
    required this.id,
    required this.childId,
    required this.subject,
    required this.title,
    required this.description,
    required this.due,
    required this.teacher,
    required this.attachment,
  });
  final String id;
  final String childId;
  final String subject;
  final String title;
  final String description;
  final String due;
  final String teacher;
  final String attachment;
}

class Notice {
  const Notice({
    required this.id,
    required this.title,
    required this.body,
    this.important = false,
  });
  final String id;
  final String title;
  final String body;
  final bool important;
}

class Invoice {
  const Invoice({
    required this.number,
    required this.childId,
    required this.title,
    required this.amount,
    required this.due,
  });
  final String number;
  final String childId;
  final String title;
  final int amount;
  final String due;
}

class Receipt {
  const Receipt({
    required this.number,
    required this.childId,
    required this.title,
    required this.amount,
    required this.paidOn,
  });
  final String number;
  final String childId;
  final String title;
  final int amount;
  final String paidOn;
}

class ReportCard {
  const ReportCard({
    required this.childId,
    required this.exam,
    required this.publishedOn,
    required this.attendance,
    required this.grades,
    required this.remark,
  });
  final String childId;
  final String exam;
  final String publishedOn;
  final int attendance;
  final Map<String, String> grades;
  final String remark;
}

class CalendarEvent {
  const CalendarEvent({
    required this.title,
    required this.date,
    required this.detail,
    required this.color,
    required this.icon,
  });
  final String title;
  final int date;
  final String detail;
  final Color color;
  final IconData icon;
}

class LearningSummary {
  const LearningSummary({
    required this.childId,
    required this.strengths,
    required this.focus,
    required this.observation,
  });
  final String childId;
  final List<String> strengths;
  final List<String> focus;
  final String observation;
}

class WalletTransaction {
  const WalletTransaction({
    required this.title,
    required this.amount,
    required this.time,
  });
  final String title;
  final int amount;
  final String time;
}

class TransportRoute {
  const TransportRoute({
    required this.childId,
    required this.name,
    required this.stop,
    required this.pickup,
    required this.drop,
    required this.busNumber,
  });
  final String childId;
  final String name;
  final String stop;
  final String pickup;
  final String drop;
  final String busNumber;
}

class ConsentItem {
  const ConsentItem({
    required this.id,
    required this.title,
    required this.description,
    required this.enabled,
  });
  final String id;
  final String title;
  final String description;
  final bool enabled;
}

class LibraryLoan {
  const LibraryLoan({
    required this.title,
    required this.due,
    required this.dueLabel,
    required this.color,
  });
  final String title;
  final String due;
  final String dueLabel;
  final Color color;
}

const parentChildren = <ChildProfile>[
  ChildProfile(
    id: 'aarav',
    name: 'Aarav Shrestha',
    classSection: 'Nursery-A',
    roll: 1,
    teacher: 'Ms. Sita Sharma',
  ),
  ChildProfile(
    id: 'aarohi',
    name: 'Aarohi Shrestha',
    classSection: 'LKG-A',
    roll: 4,
    teacher: 'Ms. Sita Sharma',
  ),
];

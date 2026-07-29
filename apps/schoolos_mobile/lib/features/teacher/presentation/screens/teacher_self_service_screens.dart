import 'package:flutter/material.dart';

import '../../../staff/presentation/screens/staff_leave_screen.dart';
import '../../../staff/presentation/screens/staff_payslips_screen.dart';

/// Teacher leave self-service — same own-staff APIs, teacher shell.
class TeacherLeaveScreen extends StatelessWidget {
  const TeacherLeaveScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const StaffLeaveScreen(shellRole: 'TEACHER', selectedIndex: 3);
  }
}

/// Teacher payslip self-service — same own-staff APIs, teacher shell.
class TeacherPayslipsScreen extends StatelessWidget {
  const TeacherPayslipsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const StaffPayslipsScreen(shellRole: 'TEACHER', selectedIndex: 3);
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_gradient_card.dart';
import '../../../../shared/widgets/dashboard_card.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/section_header.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../application/parent_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/parent_state_view.dart';

class ChildProfileScreen extends ConsumerStatefulWidget {
  const ChildProfileScreen({super.key, this.childId});

  final String? childId;

  @override
  ConsumerState<ChildProfileScreen> createState() => _ChildProfileScreenState();
}

class _ChildProfileScreenState extends ConsumerState<ChildProfileScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final childId = widget.childId;
      if (childId != null && mounted) {
        ref.read(parentControllerProvider.notifier).selectChild(childId);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(parentControllerProvider);
    final controller = ref.read(parentControllerProvider.notifier);

    return RoleShellScaffold(
      role: 'PARENT',
      selectedIndex: 1,
      title: 'Child Profile',
      body: ParentStateView(
        status: state.status,
        message: state.message,
        onRetry: controller.load,
        child: _ProfileContent(profile: state.profile),
      ),
    );
  }
}

class _ProfileContent extends StatelessWidget {
  const _ProfileContent({required this.profile});

  final ChildProfile? profile;

  @override
  Widget build(BuildContext context) {
    if (profile == null) {
      return const SizedBox.shrink();
    }

    final currentProfile = profile!;
    final child = currentProfile.child;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        AppGradientCard(
          gradient: const LinearGradient(
            colors: AppColors.parentGradient,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          child: Row(
            children: [
              UserAvatar(
                name: child.name,
                radius: 38,
                borderColor: Colors.white,
                borderWidth: 2,
              ),
              const SizedBox(width: AppSpacing.lg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      child.name,
                      style: Theme.of(context).textTheme.headlineMedium
                          ?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      '${child.classSection} • Roll ${child.rollNumber}',
                      style: const TextStyle(color: Colors.white70),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Academic year ${child.academicYear}',
                      style: const TextStyle(
                        color: Colors.white60,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        const SectionHeader(title: 'Student identity'),
        const SizedBox(height: AppSpacing.sm),
        AppCard(
          child: Row(
            children: [
              Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  color: AppColors.slate100,
                  borderRadius: BorderRadius.circular(AppRadius.xl),
                ),
                child: const Icon(
                  Icons.qr_code_2_rounded,
                  size: 44,
                  color: AppColors.slate500,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Text(
                  currentProfile.qrLabel,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: AppColors.slate600),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        const SectionHeader(title: 'School record'),
        const SizedBox(height: AppSpacing.sm),
        AppCard(
          child: Column(
            children: [
              _ProfileRow(
                label: 'Student ID',
                value: _orDash(currentProfile.studentSystemId),
              ),
              const Divider(),
              _ProfileRow(
                label: 'Admission no.',
                value: _orDash(currentProfile.admissionNumber),
              ),
              const Divider(),
              _ProfileRow(
                label: 'Admission date',
                value: _formatDate(currentProfile.admissionDate),
              ),
              const Divider(),
              _ProfileRow(
                label: 'Date of birth',
                value: _formatDate(currentProfile.dateOfBirth),
              ),
              const Divider(),
              _ProfileRow(
                label: 'Gender',
                value: _labelize(_orDash(currentProfile.gender)),
              ),
              const Divider(),
              _ProfileRow(
                label: 'Blood group',
                value: _orDash(currentProfile.bloodGroup),
              ),
              const Divider(),
              _ProfileRow(
                label: 'Lifecycle',
                value: _labelize(_orDash(currentProfile.lifecycleStatus)),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        const SectionHeader(title: 'Summary'),
        const SizedBox(height: AppSpacing.sm),
        DashboardCard(
          title: 'Attendance',
          value: currentProfile.attendanceSummary,
          icon: Icons.fact_check_rounded,
          iconColor: AppColors.success,
          badge: const StatusChip(status: AppStatusType.present),
        ),
        const SizedBox(height: AppSpacing.md),
        DashboardCard(
          title: 'Homework',
          value: currentProfile.homeworkSummary,
          icon: Icons.menu_book_rounded,
          iconColor: AppColors.primary,
        ),
        const SizedBox(height: AppSpacing.md),
        DashboardCard(
          title: 'Fees',
          value: currentProfile.feesSummary,
          icon: Icons.account_balance_wallet_rounded,
          iconColor: AppColors.warning,
        ),
        const SizedBox(height: AppSpacing.xl),
        const SectionHeader(title: 'Guardian and safety'),
        const SizedBox(height: AppSpacing.sm),
        AppCard(
          child: Column(
            children: [
              _ProfileRow(
                label: 'Class teacher',
                value: currentProfile.classTeacher,
              ),
              if (currentProfile.canViewGuardianSummary) ...[
                const Divider(),
                _ProfileRow(
                  label: 'Guardian summary',
                  value: currentProfile.guardianSummary,
                ),
              ],
              if (currentProfile.canViewHealthWarning &&
                  currentProfile.healthWarning != null) ...[
                const Divider(),
                _ProfileRow(
                  label: 'Health note',
                  value: currentProfile.healthWarning!,
                ),
              ],
              const Divider(),
              _ProfileRow(
                label: 'Photo consent',
                value: currentProfile.photoUsageConsent
                    ? 'Granted'
                    : 'Not granted',
              ),
              const Divider(),
              _ProfileRow(
                label: 'Data consent',
                value: currentProfile.dataProcessingConsent
                    ? 'Granted'
                    : 'Not granted',
              ),
            ],
          ),
        ),
      ],
    );
  }
}

String _orDash(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) {
    return '-';
  }
  return trimmed;
}

String _formatDate(String? value) {
  final parsed = DateTime.tryParse(value ?? '');
  if (parsed == null) {
    return '-';
  }
  return '${_month(parsed.month)} ${parsed.day}, ${parsed.year}';
}

String _labelize(String value) {
  if (value == '-') {
    return value;
  }

  return value
      .split('_')
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1).toLowerCase())
      .join(' ');
}

String _month(int month) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  if (month < 1 || month > 12) {
    return 'Date';
  }
  return months[month - 1];
}

class _ProfileRow extends StatelessWidget {
  const _ProfileRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppColors.slate500,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

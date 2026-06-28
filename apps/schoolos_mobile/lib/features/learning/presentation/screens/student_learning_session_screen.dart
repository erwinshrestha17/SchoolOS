import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../core/auth/auth_provider.dart';
import '../../../../core/errors/app_exception.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_view.dart';
import '../../../../shared/widgets/app_loading.dart';
import '../../../../shared/widgets/app_scaffold.dart';
import '../../application/learning_providers.dart';
import '../../domain/student_learning_session_models.dart';

class StudentLearningSessionScreen extends ConsumerStatefulWidget {
  const StudentLearningSessionScreen({
    super.key,
    this.initialSessionCode,
    this.initialQrToken,
  });

  final String? initialSessionCode;
  final String? initialQrToken;

  @override
  ConsumerState<StudentLearningSessionScreen> createState() =>
      _StudentLearningSessionScreenState();
}

class _StudentLearningSessionScreenState
    extends ConsumerState<StudentLearningSessionScreen> {
  late final TextEditingController _codeController;
  StudentLearningSessionJoin? _joinedSession;
  String? _message;
  String? _fieldError;
  bool _loading = false;
  bool _autoJoined = false;

  @override
  void initState() {
    super.initState();
    _codeController = TextEditingController(
      text: widget.initialSessionCode?.trim().toUpperCase() ?? '',
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final qrToken = widget.initialQrToken?.trim();
      if (!_autoJoined && qrToken != null && qrToken.isNotEmpty) {
        _autoJoined = true;
        _join(qrToken: qrToken);
      }
    });
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _join({String? qrToken}) async {
    final sessionCode = _codeController.text.trim().toUpperCase();
    if ((qrToken == null || qrToken.isEmpty) && sessionCode.isEmpty) {
      setState(() {
        _fieldError = 'Enter the code shown by your teacher.';
        _message = null;
      });
      return;
    }

    setState(() {
      _loading = true;
      _message = null;
      _fieldError = null;
      _joinedSession = null;
    });

    try {
      final joined = await ref
          .read(learningRepositoryProvider)
          .joinStudentSession(sessionCode: sessionCode, qrToken: qrToken);
      if (!mounted) return;
      setState(() {
        _joinedSession = joined;
        _message = null;
        _loading = false;
      });
    } on AppException catch (error) {
      if (!mounted) return;
      setState(() {
        _message = _safeJoinMessage(error);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _message =
            'SchoolOS could not join this learning session. Please try again.';
        _loading = false;
      });
    }
  }

  Future<void> _signOut() async {
    await ref.read(authProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context) {
    final joinedSession = _joinedSession;

    return AppScaffold(
      appBar: AppBar(
        title: const Text('Student learning session'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            onPressed: _loading ? null : _signOut,
            icon: const Icon(Icons.logout_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            if (_loading)
              const AppLoading(message: 'Checking the classroom session...')
            else if (joinedSession != null)
              _JoinedSessionCard(session: joinedSession.session)
            else
              _JoinSessionCard(
                controller: _codeController,
                fieldError: _fieldError,
                onJoin: () => _join(),
              ),
            if (_message != null) ...[
              const SizedBox(height: AppSpacing.lg),
              AppErrorView(
                title: 'Could not join session',
                message: _message!,
                onRetry: _loading ? null : () => _join(),
              ),
            ],
            const SizedBox(height: AppSpacing.xl),
            const AppEmptyState(
              title: 'Classroom access only',
              message:
                  'Student mobile access is limited to teacher-started learning sessions on approved school devices.',
              icon: Icons.school_rounded,
            ),
          ],
        ),
      ),
    );
  }
}

class _JoinSessionCard extends StatelessWidget {
  const _JoinSessionCard({
    required this.controller,
    required this.fieldError,
    required this.onJoin,
  });

  final TextEditingController controller;
  final String? fieldError;
  final VoidCallback onJoin;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Join a live session',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Use the code shown by your teacher in the classroom.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: AppSpacing.lg),
          TextField(
            controller: controller,
            textCapitalization: TextCapitalization.characters,
            autocorrect: false,
            decoration: InputDecoration(
              labelText: 'Session code',
              errorText: fieldError,
              prefixIcon: const Icon(Icons.pin_rounded),
            ),
            onSubmitted: (_) => onJoin(),
          ),
          const SizedBox(height: AppSpacing.lg),
          FilledButton.icon(
            onPressed: onJoin,
            icon: const Icon(Icons.login_rounded),
            label: const Text('Join session'),
          ),
        ],
      ),
    );
  }
}

class _JoinedSessionCard extends StatelessWidget {
  const _JoinedSessionCard({required this.session});

  final StudentLearningSession session;

  @override
  Widget build(BuildContext context) {
    final expiresAt = session.expiresAt;
    final activity = session.activity;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Colors.green),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Session joined',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            activity.title,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          if (activity.description != null &&
              activity.description!.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(activity.description!),
          ],
          const SizedBox(height: AppSpacing.lg),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              _InfoChip(label: _formatEnum(activity.difficulty)),
              _InfoChip(label: _formatEnum(activity.languageMode)),
              _InfoChip(label: '${activity.questionCount} questions'),
              if (activity.estimatedMinutes != null)
                _InfoChip(label: '${activity.estimatedMinutes} min'),
            ],
          ),
          if (expiresAt != null) ...[
            const SizedBox(height: AppSpacing.lg),
            Text(
              'This session expires at ${NepaliBsCalendar.formatNepalTime(expiresAt)}.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Chip(label: Text(label.isEmpty ? 'Session detail' : label));
  }
}

String _safeJoinMessage(AppException error) {
  if (error is PermissionException || error is ConflictAppException) {
    return 'This session is expired, ended, or not assigned to your class.';
  }
  if (error is NotFoundAppException) {
    return 'We could not find an active session with that code.';
  }
  if (error is ValidationException) {
    return 'Enter the session code exactly as shown by your teacher.';
  }
  if (error is NetworkException || error is TimeoutException) {
    return 'Check the device connection and try again.';
  }
  return 'SchoolOS could not join this learning session. Please try again.';
}

String _formatEnum(String value) {
  if (value.isEmpty) return '';
  return value
      .split('_')
      .where((part) => part.isNotEmpty)
      .map((part) => '${part[0]}${part.substring(1).toLowerCase()}')
      .join(' ');
}

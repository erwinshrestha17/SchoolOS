import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../application/teacher_providers.dart';
import '../../domain/teacher_models.dart';
import '../widgets/teacher_app_widgets.dart';

class TeacherMessagesScreen extends ConsumerWidget {
  const TeacherMessagesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final messages = ref.watch(teacherMessagesProvider);

    return RoleShellScaffold(
      role: 'TEACHER',
      selectedIndex: 3,
      title: 'Messages',
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(teacherMessagesProvider.future),
        child: messages.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(AppSpacing.lg),
            child: Column(
              children: [
                AppSkeleton(width: double.infinity, height: 72),
                SizedBox(height: AppSpacing.md),
                AppSkeleton(width: double.infinity, height: 300),
              ],
            ),
          ),
          error: (error, _) => AppExceptionView(
            error: error,
            onRetry: () => ref.invalidate(teacherMessagesProvider),
          ),
          data: (snapshot) => ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              Text(
                'Messages',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              TeacherQuietHoursBanner(availability: snapshot.availability),
              const SizedBox(height: AppSpacing.md),
              TextField(
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search_rounded),
                  hintText: 'Search messages',
                ),
                onSubmitted: (_) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Message search uses the backend thread filter in the next mobile refinement.',
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: AppSpacing.md),
              if (snapshot.threads.isEmpty)
                const AppEmptyState(
                  title: 'No parent threads',
                  message:
                      'Parent-teacher conversations assigned to you will appear here.',
                  icon: Icons.chat_bubble_outline_rounded,
                )
              else
                for (final thread in snapshot.threads) ...[
                  _ThreadCard(thread: thread),
                  const SizedBox(height: AppSpacing.md),
                ],
              TeacherLastUpdatedLabel(
                value: snapshot.lastUpdated,
                cached: snapshot.fromCache,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class TeacherMessageThreadScreen extends ConsumerStatefulWidget {
  const TeacherMessageThreadScreen({super.key, required this.threadId});

  final String threadId;

  @override
  ConsumerState<TeacherMessageThreadScreen> createState() =>
      _TeacherMessageThreadScreenState();
}

class _TeacherMessageThreadScreenState
    extends ConsumerState<TeacherMessageThreadScreen> {
  final TextEditingController _replyController = TextEditingController();

  @override
  void dispose() {
    _replyController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(teacherMessageDetailProvider(widget.threadId));

    return RoleShellScaffold(
      role: 'TEACHER',
      selectedIndex: 3,
      title: 'Message Thread',
      body: detail.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.lg),
          child: AppSkeleton(width: double.infinity, height: 420),
        ),
        error: (error, _) => AppExceptionView(
          error: error,
          onRetry: () =>
              ref.invalidate(teacherMessageDetailProvider(widget.threadId)),
        ),
        data: (value) => Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: [
                  Text(
                    value.thread.title,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  if (value.thread.context.isNotEmpty)
                    Text(
                      value.thread.context,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.slate500,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  const SizedBox(height: AppSpacing.md),
                  TeacherQuietHoursBanner(availability: value.availability),
                  const SizedBox(height: AppSpacing.md),
                  if (value.messages.isEmpty)
                    const AppEmptyState(
                      title: 'No messages yet',
                      message: 'Replies in this thread will appear here.',
                      icon: Icons.forum_outlined,
                    )
                  else
                    for (final message in value.messages) ...[
                      _MessageBubble(message: message),
                      const SizedBox(height: AppSpacing.sm),
                    ],
                ],
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _replyController,
                        enabled: value.availability.isAvailable,
                        decoration: InputDecoration(
                          hintText: value.availability.isAvailable
                              ? 'Reply to parent'
                              : 'Sending is restricted now',
                        ),
                        minLines: 1,
                        maxLines: 3,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    IconButton.filled(
                      tooltip: 'Send reply',
                      onPressed: value.availability.isAvailable
                          ? () async {
                              final text = _replyController.text.trim();
                              if (text.isEmpty) return;
                              await ref
                                  .read(teacherRepositoryProvider)
                                  .sendMessage(widget.threadId, text);
                              _replyController.clear();
                              ref.invalidate(
                                teacherMessageDetailProvider(widget.threadId),
                              );
                            }
                          : null,
                      icon: const Icon(Icons.send_rounded),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ThreadCard extends StatelessWidget {
  const _ThreadCard({required this.thread});

  final TeacherMessageThread thread;

  @override
  Widget build(BuildContext context) {
    return TeacherTaskCard(
      title: thread.title,
      subtitle: [
        if (thread.context.isNotEmpty) thread.context,
        thread.preview,
      ].join(' • '),
      icon: Icons.people_rounded,
      iconColor: AppColors.primary,
      status: StatusChip(
        status: thread.status == 'ESCALATED'
            ? AppStatusType.rejected
            : AppStatusType.pending,
        label: thread.updatedAt == null
            ? thread.status
            : DateFormat.MMMd().format(thread.updatedAt!.toLocal()),
      ),
      onTap: () => context.go(AppRoutes.teacherMessageThreadDetail(thread.id)),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});

  final TeacherMessage message;

  @override
  Widget build(BuildContext context) {
    final alignment = message.isTeacher
        ? CrossAxisAlignment.end
        : CrossAxisAlignment.start;
    final color = message.isTeacher ? AppColors.primary : Colors.white;
    final textColor = message.isTeacher ? Colors.white : AppColors.slate900;

    return Column(
      crossAxisAlignment: alignment,
      children: [
        Container(
          constraints: const BoxConstraints(maxWidth: 300),
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(16),
            border: message.isTeacher
                ? null
                : Border.all(color: AppColors.slate100),
          ),
          child: Text(message.body, style: TextStyle(color: textColor)),
        ),
        const SizedBox(height: 2),
        Text(
          message.sentAt == null
              ? message.status
              : DateFormat.jm().format(message.sentAt!.toLocal()),
          style: Theme.of(
            context,
          ).textTheme.labelSmall?.copyWith(color: AppColors.slate400),
        ),
      ],
    );
  }
}

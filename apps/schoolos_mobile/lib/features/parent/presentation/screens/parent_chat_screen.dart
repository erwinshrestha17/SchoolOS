import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/design_system/app_radius.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../application/parent_providers.dart';
import '../../domain/parent_models.dart';
import '../widgets/child_switcher.dart';
import '../widgets/parent_state_view.dart';

class ParentChatScreen extends ConsumerWidget {
  const ParentChatScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(parentControllerProvider);
    final controller = ref.read(parentControllerProvider.notifier);
    final childId = state.selectedChildId;

    return RoleShellScaffold(
      role: 'PARENT',
      selectedIndex: 4,
      title: 'Teacher chat',
      body: ParentStateView(
        status: state.status,
        message: state.message,
        onRetry: controller.load,
        child: childId == null
            ? const AppEmptyState(
                title: 'No child selected',
                message: 'Select a child before opening teacher chat.',
                icon: Icons.forum_rounded,
              )
            : _ParentChatContent(
                childId: childId,
                children: state.children,
                selectedChildId: state.selectedChildId,
                onChildSelected: controller.selectChild,
              ),
      ),
    );
  }
}

class _ParentChatContent extends ConsumerStatefulWidget {
  const _ParentChatContent({
    required this.childId,
    required this.children,
    required this.selectedChildId,
    required this.onChildSelected,
  });

  final String childId;
  final List<GuardianChild> children;
  final String? selectedChildId;
  final ValueChanged<String> onChildSelected;

  @override
  ConsumerState<_ParentChatContent> createState() => _ParentChatContentState();
}

class _ParentChatContentState extends ConsumerState<_ParentChatContent> {
  final _messageController = TextEditingController();
  final _markedReadThreadIds = <String>{};
  String? _activeThreadId;
  bool _openingThread = false;
  bool _sending = false;

  @override
  void didUpdateWidget(covariant _ParentChatContent oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.childId != widget.childId) {
      _activeThreadId = null;
      _markedReadThreadIds.clear();
    }
  }

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final threads = ref.watch(parentTeacherThreadsProvider(widget.childId));

    return threads.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            AppSkeleton(width: double.infinity, height: 78),
            SizedBox(height: AppSpacing.md),
            AppSkeleton(width: double.infinity, height: 132),
            SizedBox(height: AppSpacing.md),
            AppSkeleton(width: double.infinity, height: 220),
          ],
        ),
      ),
      error: (_, _) => AppErrorView(
        title: 'Could not load chat',
        message: 'Please try again in a moment.',
        onRetry: () =>
            ref.invalidate(parentTeacherThreadsProvider(widget.childId)),
      ),
      data: (page) {
        if (page.items.isEmpty) {
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              ChildSwitcher(
                children: widget.children,
                selectedChildId: widget.selectedChildId,
                onSelected: _selectChild,
              ),
              const SizedBox(height: AppSpacing.xl),
              AppEmptyState(
                title: 'No teacher chat yet',
                message:
                    'Start a parent-teacher thread for this child when you need to contact the class teacher.',
                icon: Icons.forum_rounded,
                actionLabel: _openingThread ? 'Opening...' : 'Start chat',
                onActionPressed: _openingThread ? null : _openThread,
              ),
            ],
          );
        }

        final activeThread = page.items.firstWhere(
          (thread) => thread.id == _activeThreadId,
          orElse: () => page.items.first,
        );

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.sm,
              ),
              child: ChildSwitcher(
                children: widget.children,
                selectedChildId: widget.selectedChildId,
                onSelected: _selectChild,
              ),
            ),
            _ThreadStrip(
              threads: page.items,
              activeThreadId: activeThread.id,
              openingThread: _openingThread,
              onSelect: (threadId) => setState(() {
                _activeThreadId = threadId;
              }),
              onOpenThread: _openThread,
            ),
            Expanded(
              child: _MessagePane(
                thread: activeThread,
                onMarkThreadRead: _markThreadRead,
              ),
            ),
            _Composer(
              controller: _messageController,
              disabled: activeThread.isClosed || _sending,
              sending: _sending,
              onSend: () => _sendMessage(activeThread.id),
            ),
          ],
        );
      },
    );
  }

  void _selectChild(String childId) {
    setState(() {
      _activeThreadId = null;
    });
    widget.onChildSelected(childId);
  }

  Future<void> _openThread() async {
    setState(() {
      _openingThread = true;
    });

    try {
      final thread = await ref
          .read(parentRepositoryProvider)
          .openParentTeacherThread(widget.childId);
      if (!mounted) {
        return;
      }
      setState(() {
        _activeThreadId = thread.id;
      });
      ref.invalidate(parentTeacherThreadsProvider(widget.childId));
    } catch (_) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not open teacher chat. Please try again.'),
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _openingThread = false;
        });
      }
    }
  }

  Future<void> _sendMessage(String threadId) async {
    final message = _messageController.text.trim();
    if (message.isEmpty) {
      return;
    }

    setState(() {
      _sending = true;
    });

    try {
      final result = await ref
          .read(parentRepositoryProvider)
          .sendParentTeacherMessage(threadId: threadId, message: message);
      _messageController.clear();
      ref.invalidate(parentTeacherMessagesProvider(threadId));
      ref.invalidate(parentTeacherThreadsProvider(widget.childId));

      if (!mounted || result.queuedNotice == null) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(result.queuedNotice!)));
    } catch (_) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Message was not sent. Please try again.'),
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _sending = false;
        });
      }
    }
  }

  void _markThreadRead(String threadId) {
    if (_markedReadThreadIds.contains(threadId)) {
      return;
    }

    _markedReadThreadIds.add(threadId);
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        await ref
            .read(parentRepositoryProvider)
            .markParentTeacherThreadRead(threadId);
      } catch (_) {
        _markedReadThreadIds.remove(threadId);
      }
    });
  }
}

class _ThreadStrip extends StatelessWidget {
  const _ThreadStrip({
    required this.threads,
    required this.activeThreadId,
    required this.openingThread,
    required this.onSelect,
    required this.onOpenThread,
  });

  final List<ParentTeacherThread> threads;
  final String activeThreadId;
  final bool openingThread;
  final ValueChanged<String> onSelect;
  final VoidCallback onOpenThread;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 112,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        scrollDirection: Axis.horizontal,
        itemCount: threads.length + 1,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
        itemBuilder: (context, index) {
          if (index == threads.length) {
            return SizedBox(
              width: 136,
              child: AppButton(
                label: openingThread ? 'Opening' : 'New chat',
                icon: Icons.add_comment_rounded,
                variant: AppButtonVariant.outlined,
                fullWidth: false,
                isLoading: openingThread,
                onPressed: openingThread ? null : onOpenThread,
              ),
            );
          }

          final thread = threads[index];
          final selected = thread.id == activeThreadId;
          final latest = thread.latestMessage?.message ?? 'No messages yet';

          return InkWell(
            borderRadius: BorderRadius.circular(AppRadius.xl),
            onTap: () => onSelect(thread.id),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: 248,
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: selected
                    ? AppColors.parentAccent.withValues(alpha: 0.12)
                    : Theme.of(context).cardColor,
                borderRadius: BorderRadius.circular(AppRadius.xl),
                border: Border.all(
                  color: selected ? AppColors.parentAccent : AppColors.slate200,
                  width: selected ? 2 : 1,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          thread.teacherName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ),
                      _ThreadStatusPill(status: thread.status),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    thread.classSection.isEmpty
                        ? thread.studentName
                        : '${thread.studentName} - ${thread.classSection}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: AppColors.slate500),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    latest,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _MessagePane extends ConsumerWidget {
  const _MessagePane({required this.thread, required this.onMarkThreadRead});

  final ParentTeacherThread thread;
  final ValueChanged<String> onMarkThreadRead;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final messages = ref.watch(parentTeacherMessagesProvider(thread.id));

    return messages.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            AppSkeleton(width: double.infinity, height: 74),
            SizedBox(height: AppSpacing.md),
            AppSkeleton(width: double.infinity, height: 96),
            SizedBox(height: AppSpacing.md),
            AppSkeleton(width: double.infinity, height: 74),
          ],
        ),
      ),
      error: (_, _) => AppErrorView(
        title: 'Could not load messages',
        message: 'Pull to refresh or try again in a moment.',
        onRetry: () => ref.invalidate(parentTeacherMessagesProvider(thread.id)),
      ),
      data: (items) {
        onMarkThreadRead(thread.id);

        if (items.isEmpty) {
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              _ChatIntroCard(thread: thread),
              const SizedBox(height: AppSpacing.lg),
              const AppEmptyState(
                title: 'No messages yet',
                message: 'Send a short note to start the conversation.',
                icon: Icons.chat_bubble_outline_rounded,
              ),
            ],
          );
        }

        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(parentTeacherMessagesProvider(thread.id));
            await ref.read(parentTeacherMessagesProvider(thread.id).future);
          },
          child: ListView.builder(
            padding: const EdgeInsets.all(AppSpacing.lg),
            itemCount: items.length + 1,
            itemBuilder: (context, index) {
              if (index == 0) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                  child: _ChatIntroCard(thread: thread),
                );
              }

              return _MessageBubble(message: items[index - 1]);
            },
          ),
        );
      },
    );
  }
}

class _ChatIntroCard extends StatelessWidget {
  const _ChatIntroCard({required this.thread});

  final ParentTeacherThread thread;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.parentAccent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppRadius.lg),
            ),
            child: const Icon(
              Icons.school_rounded,
              color: AppColors.parentAccent,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  thread.teacherName,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  thread.sla,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: AppColors.slate500),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});

  final ParentTeacherMessage message;

  @override
  Widget build(BuildContext context) {
    final isMine = message.isParentSender;
    final theme = Theme.of(context);

    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 320),
        margin: const EdgeInsets.only(bottom: AppSpacing.md),
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: isMine ? AppColors.parentAccent : AppColors.slate100,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(AppRadius.lg),
            topRight: const Radius.circular(AppRadius.lg),
            bottomLeft: Radius.circular(isMine ? AppRadius.lg : AppRadius.xs),
            bottomRight: Radius.circular(isMine ? AppRadius.xs : AppRadius.lg),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isMine ? 'You' : _labelize(message.senderRole),
              style: theme.textTheme.bodySmall?.copyWith(
                color: isMine ? Colors.white70 : AppColors.slate500,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              message.message,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: isMine ? Colors.white : AppColors.slate900,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              _formatDateTime(message.sentAt),
              style: theme.textTheme.bodySmall?.copyWith(
                color: isMine ? Colors.white70 : AppColors.slate500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.disabled,
    required this.sending,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool disabled;
  final bool sending;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.sm,
          AppSpacing.lg,
          AppSpacing.md,
        ),
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          border: const Border(top: BorderSide(color: AppColors.slate200)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                minLines: 1,
                maxLines: 4,
                enabled: !disabled,
                textInputAction: TextInputAction.newline,
                decoration: InputDecoration(
                  hintText: disabled
                      ? 'This chat is closed'
                      : 'Write a message to the class teacher',
                  prefixIcon: const Icon(Icons.chat_bubble_outline_rounded),
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            SizedBox(
              height: 52,
              width: 52,
              child: IconButton.filled(
                onPressed: disabled ? null : onSend,
                icon: sending
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            Colors.white,
                          ),
                        ),
                      )
                    : const Icon(Icons.send_rounded),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ThreadStatusPill extends StatelessWidget {
  const _ThreadStatusPill({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final isClosed = status == 'CLOSED';
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: isClosed
            ? AppColors.slate200
            : AppColors.success.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.max),
      ),
      child: Text(
        _labelize(status),
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: isClosed ? AppColors.slate600 : AppColors.success,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

String _formatDateTime(String? value) {
  if (value == null || value.isEmpty) {
    return 'Sending';
  }
  final parsed = DateTime.tryParse(value);
  if (parsed == null) {
    return '';
  }
  return DateFormat('MMM d, h:mm a').format(parsed.toLocal());
}

String _labelize(String value) {
  return value
      .split('_')
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1).toLowerCase())
      .join(' ');
}

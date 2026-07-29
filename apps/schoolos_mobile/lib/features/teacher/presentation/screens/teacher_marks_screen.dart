import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/constants/app_routes.dart';
import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../../../shared/widgets/app_loading.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../application/teacher_marks_providers.dart';
import '../../data/teacher_marks_repository.dart';

class TeacherMarksScreen extends ConsumerWidget {
  const TeacherMarksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final components = ref.watch(teacherAssessmentComponentsProvider);

    return RoleShellScaffold(
      role: 'TEACHER',
      selectedIndex: 3,
      title: 'Marks',
      body: components.when(
        loading: () => const AppLoading(message: 'Loading assessments...'),
        error: (error, _) => AppExceptionView(
          error: error,
          onRetry: () => ref.invalidate(teacherAssessmentComponentsProvider),
        ),
        data: (items) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(teacherAssessmentComponentsProvider);
            await ref.read(teacherAssessmentComponentsProvider.future);
          },
          child: items.isEmpty
              ? ListView(
                  children: const [
                    SizedBox(height: AppSpacing.xxxl),
                    AppEmptyState(
                      title: 'No open assessments',
                      message:
                          'Assigned exam components open for marks entry will appear here.',
                      icon: Icons.fact_check_outlined,
                    ),
                  ],
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: items.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSpacing.md),
                  itemBuilder: (context, index) {
                    final component = items[index];
                    return AppCard(
                      onTap: component.isLocked
                          ? null
                          : () => context.push(
                              '${AppRoutes.teacherMarks}/${Uri.encodeComponent(component.id)}',
                              extra: component,
                            ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            component.name,
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${component.className} · ${component.subjectName}',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: AppColors.slate500),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Row(
                            children: [
                              StatusChip(
                                status: component.isLocked
                                    ? AppStatusType.rejected
                                    : AppStatusType.approved,
                                label: component.isLocked
                                    ? 'Locked'
                                    : 'Open for entry',
                              ),
                              const Spacer(),
                              Text(
                                'Max ${component.maxMarks}',
                                style: Theme.of(context).textTheme.labelMedium,
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            component.examTermName,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}

class TeacherMarksEntryScreen extends ConsumerStatefulWidget {
  const TeacherMarksEntryScreen({super.key, required this.component});

  final TeacherAssessmentComponent component;

  @override
  ConsumerState<TeacherMarksEntryScreen> createState() =>
      _TeacherMarksEntryScreenState();
}

class _TeacherMarksEntryScreenState
    extends ConsumerState<TeacherMarksEntryScreen> {
  final Map<String, TextEditingController> _controllers = {};
  final Set<String> _absent = {};
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final marks = ref.watch(teacherComponentMarksProvider(widget.component));

    return RoleShellScaffold(
      role: 'TEACHER',
      selectedIndex: 3,
      title: 'Enter marks',
      body: marks.when(
        loading: () => const AppLoading(message: 'Loading roster marks...'),
        error: (error, _) => AppExceptionView(
          error: error,
          onRetry: () =>
              ref.invalidate(teacherComponentMarksProvider(widget.component)),
        ),
        data: (entries) {
          for (final entry in entries) {
            _controllers.putIfAbsent(
              entry.studentId,
              () => TextEditingController(
                text: entry.marksObtained?.toString() ?? '',
              ),
            );
            if (entry.isAbsent) _absent.add(entry.studentId);
          }

          if (entries.isEmpty) {
            return const AppEmptyState(
              title: 'No students to mark',
              message:
                  'Marks appear after students are enrolled in the assigned class.',
              icon: Icons.people_outline_rounded,
            );
          }

          return Column(
            children: [
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Text(
                    _error!,
                    style: TextStyle(color: AppColors.dangerDark),
                  ),
                ),
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: entries.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, index) {
                    final entry = entries[index];
                    final locked = entry.isLocked || widget.component.isLocked;
                    final isAbsent = _absent.contains(entry.studentId);
                    return AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            entry.studentName,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          if (entry.rollNumber.isNotEmpty)
                            Text('Roll ${entry.rollNumber}'),
                          const SizedBox(height: AppSpacing.sm),
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: _controllers[entry.studentId],
                                  enabled: !locked && !isAbsent,
                                  keyboardType:
                                      const TextInputType.numberWithOptions(
                                        decimal: true,
                                      ),
                                  decoration: InputDecoration(
                                    labelText:
                                        'Marks / ${widget.component.maxMarks}',
                                    isDense: true,
                                  ),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              FilterChip(
                                label: const Text('Absent'),
                                selected: isAbsent,
                                onSelected: locked
                                    ? null
                                    : (selected) {
                                        setState(() {
                                          if (selected) {
                                            _absent.add(entry.studentId);
                                            _controllers[entry.studentId]
                                                    ?.text =
                                                '';
                                          } else {
                                            _absent.remove(entry.studentId);
                                          }
                                        });
                                      },
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: FilledButton(
                    onPressed: _saving || widget.component.isLocked
                        ? null
                        : () => _save(entries),
                    child: Text(_saving ? 'Saving...' : 'Save marks'),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _save(List<TeacherMarkEntry> entries) async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final upserts = <TeacherMarkUpsert>[];
      for (final entry in entries) {
        if (entry.isLocked) continue;
        final absent = _absent.contains(entry.studentId);
        final raw = _controllers[entry.studentId]?.text.trim() ?? '';
        if (!absent && raw.isEmpty) continue;
        final value = absent ? null : num.tryParse(raw);
        if (!absent && value == null) {
          throw StateError('Enter a valid mark for ${entry.studentName}.');
        }
        upserts.add(
          TeacherMarkUpsert(
            studentId: entry.studentId,
            marksObtained: value,
            isAbsent: absent,
          ),
        );
      }
      if (upserts.isEmpty) {
        throw StateError('No mark changes to save.');
      }
      await ref
          .read(teacherMarksRepositoryProvider)
          .bulkUpsert(
            examTermId: widget.component.examTermId,
            assessmentComponentId: widget.component.id,
            classId: widget.component.classId,
            subjectId: widget.component.subjectId,
            entries: upserts,
          );
      ref.invalidate(teacherComponentMarksProvider(widget.component));
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Marks saved.')));
      }
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

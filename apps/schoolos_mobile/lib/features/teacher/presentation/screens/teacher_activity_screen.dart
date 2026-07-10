import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../app/design_system/app_spacing.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/errors/app_exception.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_exception_view.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../../../shared/widgets/role_shell_scaffold.dart';
import '../../../../shared/widgets/status_chip.dart';
import '../../application/teacher_providers.dart';
import '../../domain/teacher_models.dart';
import '../widgets/teacher_app_widgets.dart';

enum _CaptureMode { activity, milestone }

class TeacherActivityScreen extends ConsumerStatefulWidget {
  const TeacherActivityScreen({super.key});

  @override
  ConsumerState<TeacherActivityScreen> createState() =>
      _TeacherActivityScreenState();
}

class _TeacherActivityScreenState extends ConsumerState<TeacherActivityScreen> {
  static const _maxMediaCount = 5;
  static const _maxMediaBytes = 8 * 1024 * 1024;

  final _titleController = TextEditingController();
  final _captionController = TextEditingController();
  final _domainController = TextEditingController();
  final _milestoneController = TextEditingController();
  final _observationController = TextEditingController();
  final _picker = ImagePicker();

  _CaptureMode _mode = _CaptureMode.activity;
  TeacherActivityScope? _scope;
  List<TeacherActivityStudent> _students = const [];
  final Set<String> _selectedStudentIds = {};
  final List<TeacherActivityMedia> _media = [];
  String _category = 'GENERAL';
  String _milestoneStatus = 'PROGRESSING';
  bool _studentsLoading = false;
  bool _submitting = false;
  bool _retryPending = false;
  int _studentPage = 0;
  int _studentTotalPages = 0;
  String? _submissionId;
  String? _milestoneSubmissionId;
  String? _message;
  bool _messageIsError = false;

  @override
  void dispose() {
    _titleController.dispose();
    _captionController.dispose();
    _domainController.dispose();
    _milestoneController.dispose();
    _observationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final activity = ref.watch(teacherActivityProvider);

    return RoleShellScaffold(
      role: 'TEACHER',
      selectedIndex: 0,
      title: 'Activities',
      body: activity.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.lg),
          child: Column(
            children: [
              AppSkeleton(width: double.infinity, height: 48),
              SizedBox(height: AppSpacing.md),
              AppSkeleton(width: double.infinity, height: 340),
            ],
          ),
        ),
        error: (error, _) => AppExceptionView(
          error: error,
          onRetry: () => ref.invalidate(teacherActivityProvider),
        ),
        data: (snapshot) {
          if (snapshot.scopes.isEmpty) {
            return const AppEmptyState(
              title: 'No activity classes assigned',
              message:
                  'Activity capture becomes available after a current class assignment is added.',
              icon: Icons.photo_camera_outlined,
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(teacherActivityProvider);
              await ref.read(teacherActivityProvider.future);
            },
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                TeacherScreenFrameHeader(
                  title: 'Activity & milestones',
                  subtitle: 'Capture a class update or record an observation.',
                ),
                const SizedBox(height: AppSpacing.lg),
                SegmentedButton<_CaptureMode>(
                  segments: const [
                    ButtonSegment(
                      value: _CaptureMode.activity,
                      label: Text('Activity'),
                      icon: Icon(Icons.photo_camera_rounded),
                    ),
                    ButtonSegment(
                      value: _CaptureMode.milestone,
                      label: Text('Milestone'),
                      icon: Icon(Icons.flag_rounded),
                    ),
                  ],
                  selected: {_mode},
                  onSelectionChanged: _retryPending
                      ? null
                      : (selection) {
                          setState(() {
                            _mode = selection.first;
                            _selectedStudentIds.clear();
                            _clearMessage();
                          });
                        },
                ),
                const SizedBox(height: AppSpacing.lg),
                _buildScopeField(snapshot.scopes),
                const SizedBox(height: AppSpacing.lg),
                if (_scope != null) ...[
                  _buildStudentPicker(),
                  const SizedBox(height: AppSpacing.lg),
                  if (_mode == _CaptureMode.activity)
                    _buildActivityForm()
                  else
                    _buildMilestoneForm(),
                ],
                if (_message != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  _InlineMessage(message: _message!, isError: _messageIsError),
                ],
                const SizedBox(height: AppSpacing.lg),
                _buildSubmitButton(),
                const SizedBox(height: AppSpacing.xl),
                _RecentActivitySection(posts: snapshot.posts),
                if (snapshot.fromCache)
                  TeacherLastUpdatedLabel(
                    value: snapshot.lastUpdated,
                    cached: true,
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildScopeField(List<TeacherActivityScope> scopes) {
    return DropdownButtonFormField<TeacherActivityScope>(
      initialValue: _scope,
      decoration: const InputDecoration(
        labelText: 'Assigned class',
        prefixIcon: Icon(Icons.school_rounded),
      ),
      isExpanded: true,
      items: scopes
          .map(
            (scope) => DropdownMenuItem(
              value: scope,
              child: Text(
                '${scope.label} • ${scope.academicYearName}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          )
          .toList(),
      onChanged: _retryPending
          ? null
          : (scope) {
              if (scope == null) return;
              setState(() {
                _scope = scope;
                _students = const [];
                _selectedStudentIds.clear();
                _studentPage = 0;
                _studentTotalPages = 0;
                _clearMessage();
              });
              _loadStudents(scope, reset: true);
            },
    );
  }

  Widget _buildStudentPicker() {
    if (_studentsLoading && _students.isEmpty) {
      return const AppSkeleton(width: double.infinity, height: 180);
    }
    if (_students.isEmpty) {
      return const AppEmptyState(
        title: 'No active students',
        message: 'This assigned class has no active students to select.',
        icon: Icons.groups_outlined,
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          _mode == _CaptureMode.activity
              ? 'Students visible in media'
              : 'Student observed',
          style: Theme.of(
            context,
          ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: AppSpacing.xs),
        for (final student in _students)
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            dense: true,
            controlAffinity: ListTileControlAffinity.leading,
            value: _selectedStudentIds.contains(student.id),
            onChanged:
                (_mode == _CaptureMode.activity &&
                        !student.mediaConsentGranted) ||
                    _retryPending
                ? null
                : (selected) {
                    setState(() {
                      if (_mode == _CaptureMode.milestone) {
                        _selectedStudentIds.clear();
                      }
                      if (selected ?? false) {
                        _selectedStudentIds.add(student.id);
                      } else {
                        _selectedStudentIds.remove(student.id);
                      }
                      _clearMessage();
                    });
                  },
            title: Text(
              student.fullName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Text(
              _mode == _CaptureMode.milestone || student.mediaConsentGranted
                  ? [
                      if (student.rollNumber != null)
                        'Roll ${student.rollNumber}',
                      student.studentSystemId,
                    ].where((value) => value.isNotEmpty).join(' • ')
                  : 'Photo consent unavailable',
            ),
            secondary:
                _mode == _CaptureMode.milestone || student.mediaConsentGranted
                ? null
                : const Icon(Icons.lock_outline_rounded),
          ),
        if (_studentPage < _studentTotalPages)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: _studentsLoading || _retryPending
                  ? null
                  : () => _loadStudents(_scope!, reset: false),
              icon: _studentsLoading
                  ? const SizedBox.square(
                      dimension: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.expand_more_rounded),
              label: const Text('Load more students'),
            ),
          ),
      ],
    );
  }

  Widget _buildActivityForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: _titleController,
          enabled: !_retryPending,
          maxLength: 120,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(labelText: 'Activity title'),
        ),
        const SizedBox(height: AppSpacing.md),
        TextField(
          controller: _captionController,
          enabled: !_retryPending,
          minLines: 3,
          maxLines: 5,
          maxLength: 600,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(labelText: 'Class update'),
        ),
        const SizedBox(height: AppSpacing.md),
        DropdownButtonFormField<String>(
          initialValue: _category,
          decoration: const InputDecoration(labelText: 'Category'),
          items: _activityCategories
              .map(
                (entry) =>
                    DropdownMenuItem(value: entry.$1, child: Text(entry.$2)),
              )
              .toList(),
          onChanged: _retryPending
              ? null
              : (value) => setState(() => _category = value ?? 'GENERAL'),
        ),
        const SizedBox(height: AppSpacing.lg),
        Row(
          children: [
            Expanded(
              child: Text(
                'Photos (${_media.length}/$_maxMediaCount)',
                style: Theme.of(
                  context,
                ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
              ),
            ),
            IconButton(
              tooltip: 'Take photo',
              onPressed: _retryPending || _media.length >= _maxMediaCount
                  ? null
                  : () => _pickMedia(ImageSource.camera),
              icon: const Icon(Icons.photo_camera_rounded),
            ),
            IconButton(
              tooltip: 'Choose photos',
              onPressed: _retryPending || _media.length >= _maxMediaCount
                  ? null
                  : () => _pickMedia(ImageSource.gallery),
              icon: const Icon(Icons.photo_library_rounded),
            ),
          ],
        ),
        if (_media.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            height: 88,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _media.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
              itemBuilder: (context, index) {
                final media = _media[index];
                return Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.memory(
                        media.bytes,
                        width: 88,
                        height: 88,
                        fit: BoxFit.cover,
                        gaplessPlayback: true,
                      ),
                    ),
                    Positioned(
                      top: 2,
                      right: 2,
                      child: IconButton.filled(
                        tooltip: 'Remove photo',
                        visualDensity: VisualDensity.compact,
                        onPressed: _retryPending
                            ? null
                            : () => setState(() => _media.removeAt(index)),
                        icon: const Icon(Icons.close_rounded, size: 16),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildMilestoneForm() {
    return Column(
      children: [
        TextField(
          controller: _domainController,
          maxLength: 80,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(labelText: 'Development domain'),
        ),
        const SizedBox(height: AppSpacing.md),
        TextField(
          controller: _milestoneController,
          maxLength: 240,
          minLines: 2,
          maxLines: 4,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(labelText: 'Milestone observed'),
        ),
        const SizedBox(height: AppSpacing.md),
        DropdownButtonFormField<String>(
          initialValue: _milestoneStatus,
          decoration: const InputDecoration(labelText: 'Progress'),
          items: _milestoneStatuses
              .map(
                (entry) =>
                    DropdownMenuItem(value: entry.$1, child: Text(entry.$2)),
              )
              .toList(),
          onChanged: (value) =>
              setState(() => _milestoneStatus = value ?? 'PROGRESSING'),
        ),
        const SizedBox(height: AppSpacing.md),
        TextField(
          controller: _observationController,
          maxLength: 500,
          minLines: 2,
          maxLines: 4,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(labelText: 'Observation note'),
        ),
      ],
    );
  }

  Widget _buildSubmitButton() {
    final label = _submitting
        ? 'Saving'
        : _retryPending
        ? 'Retry upload'
        : _mode == _CaptureMode.activity
        ? 'Upload activity'
        : 'Save milestone';

    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: _submitting || _scope == null ? null : _submit,
        icon: _submitting
            ? const SizedBox.square(
                dimension: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : Icon(
                _retryPending
                    ? Icons.refresh_rounded
                    : _mode == _CaptureMode.activity
                    ? Icons.cloud_upload_rounded
                    : Icons.check_rounded,
              ),
        label: Text(label),
      ),
    );
  }

  Future<void> _loadStudents(
    TeacherActivityScope scope, {
    required bool reset,
  }) async {
    if (_studentsLoading) return;
    setState(() => _studentsLoading = true);
    try {
      final nextPage = reset ? 1 : _studentPage + 1;
      final result = await ref
          .read(teacherRepositoryProvider)
          .getActivityStudents(scope: scope, page: nextPage);
      if (!mounted || _scope?.id != scope.id) return;
      setState(() {
        _students = reset ? result.items : [..._students, ...result.items];
        _studentPage = result.page;
        _studentTotalPages = result.totalPages;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _message = 'Students could not be loaded.';
          _messageIsError = true;
        });
      }
    } finally {
      if (mounted) setState(() => _studentsLoading = false);
    }
  }

  Future<void> _pickMedia(ImageSource source) async {
    try {
      late List<XFile> files;
      if (source == ImageSource.camera) {
        final file = await _picker.pickImage(
          source: ImageSource.camera,
          maxWidth: 1600,
          maxHeight: 1600,
          imageQuality: 78,
          requestFullMetadata: false,
        );
        files = file == null ? const [] : [file];
      } else {
        files = await _picker.pickMultiImage(
          maxWidth: 1600,
          maxHeight: 1600,
          imageQuality: 78,
          limit: _maxMediaCount - _media.length,
          requestFullMetadata: false,
        );
      }

      final selected = <TeacherActivityMedia>[];
      for (final file in files.take(_maxMediaCount - _media.length)) {
        final bytes = await file.readAsBytes();
        if (bytes.length > _maxMediaBytes) {
          if (mounted) {
            setState(() {
              _message = 'One compressed photo is still too large.';
              _messageIsError = true;
            });
          }
          continue;
        }
        final contentType = _imageContentType(file);
        if (contentType == null) {
          if (mounted) {
            setState(() {
              _message = 'One selected file is not a supported photo.';
              _messageIsError = true;
            });
          }
          continue;
        }
        selected.add(
          TeacherActivityMedia(
            fileName: file.name,
            contentType: contentType,
            bytes: bytes,
          ),
        );
      }

      if (mounted && selected.isNotEmpty) {
        setState(() {
          _media.addAll(selected);
          _clearMessage();
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _message = 'Photos could not be opened.';
          _messageIsError = true;
        });
      }
    }
  }

  Future<void> _submit() async {
    final scope = _scope;
    if (scope == null) return;
    if (_selectedStudentIds.isEmpty) {
      setState(() {
        _message = 'Select at least one student.';
        _messageIsError = true;
      });
      return;
    }

    if (_mode == _CaptureMode.milestone) {
      await _submitMilestone(scope);
      return;
    }

    if (_titleController.text.trim().length < 2 ||
        _captionController.text.trim().length < 2 ||
        _media.isEmpty) {
      setState(() {
        _message = 'Add a title, class update, and at least one photo.';
        _messageIsError = true;
      });
      return;
    }

    setState(() {
      _submitting = true;
      _submissionId ??= _newUuid();
      _clearMessage();
    });
    try {
      await ref
          .read(teacherRepositoryProvider)
          .createActivityPost(
            clientSubmissionId: _submissionId!,
            scope: scope,
            title: _titleController.text,
            caption: _captionController.text,
            category: _category,
            studentIds: _selectedStudentIds.toList(),
            attachments: List.unmodifiable(_media),
          );
      if (!mounted) return;
      _titleController.clear();
      _captionController.clear();
      setState(() {
        _media.clear();
        _selectedStudentIds.clear();
        _submissionId = null;
        _retryPending = false;
        _message = 'Activity uploaded for school review.';
        _messageIsError = false;
      });
      ref.invalidate(teacherActivityProvider);
    } on AppException catch (error) {
      if (!mounted) return;
      setState(() {
        _retryPending = error is NetworkException || error is TimeoutException;
        _message = _retryPending
            ? 'Upload status is unknown. Retry to confirm this submission.'
            : error is PermissionException
            ? 'This activity is not allowed for the selected students.'
            : 'Activity could not be uploaded.';
        _messageIsError = true;
        if (!_retryPending) _submissionId = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _retryPending = true;
        _message =
            'Upload status is unknown. Retry to confirm this submission.';
        _messageIsError = true;
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _submitMilestone(TeacherActivityScope scope) async {
    if (_selectedStudentIds.length != 1 ||
        _domainController.text.trim().isEmpty ||
        _milestoneController.text.trim().isEmpty) {
      setState(() {
        _message = 'Select one student and complete the milestone fields.';
        _messageIsError = true;
      });
      return;
    }

    setState(() {
      _submitting = true;
      _milestoneSubmissionId ??= _newUuid();
      _clearMessage();
    });
    try {
      await ref
          .read(teacherRepositoryProvider)
          .createMilestone(
            clientSubmissionId: _milestoneSubmissionId!,
            scope: scope,
            studentId: _selectedStudentIds.single,
            domain: _domainController.text,
            milestone: _milestoneController.text,
            status: _milestoneStatus,
            observationNote: _observationController.text,
          );
      if (!mounted) return;
      _domainController.clear();
      _milestoneController.clear();
      _observationController.clear();
      setState(() {
        _selectedStudentIds.clear();
        _milestoneSubmissionId = null;
        _retryPending = false;
        _message = 'Milestone saved.';
        _messageIsError = false;
      });
    } on AppException catch (error) {
      if (!mounted) return;
      setState(() {
        _retryPending = error is NetworkException || error is TimeoutException;
        _message = _retryPending
            ? 'Milestone status is unknown. Retry to confirm this submission.'
            : 'Milestone could not be saved.';
        _messageIsError = true;
        if (!_retryPending) _milestoneSubmissionId = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _retryPending = true;
        _message =
            'Milestone status is unknown. Retry to confirm this submission.';
        _messageIsError = true;
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _clearMessage() {
    _message = null;
    _messageIsError = false;
  }
}

class _InlineMessage extends StatelessWidget {
  const _InlineMessage({required this.message, required this.isError});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final color = isError ? AppColors.danger : AppColors.success;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        border: Border.all(color: color.withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(
            isError ? Icons.error_outline_rounded : Icons.check_circle_rounded,
            color: color,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(message)),
        ],
      ),
    );
  }
}

class _RecentActivitySection extends StatelessWidget {
  const _RecentActivitySection({required this.posts});

  final List<TeacherActivityPost> posts;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Recent uploads',
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (posts.isEmpty)
          const Text('No activity uploads yet.')
        else
          for (final post in posts.take(5))
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(
                Icons.photo_library_outlined,
                color: AppColors.teacherAccent,
              ),
              title: Text(
                post.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Text(
                '${post.classLabel} • ${post.attachments.length} photo(s)',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: StatusChip(
                status: _postStatus(post),
                label: _postStatusLabel(post),
              ),
            ),
      ],
    );
  }
}

class TeacherScreenFrameHeader extends StatelessWidget {
  const TeacherScreenFrameHeader({
    super.key,
    required this.title,
    required this.subtitle,
  });

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(
            context,
          ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          subtitle,
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: AppColors.slate500),
        ),
      ],
    );
  }
}

AppStatusType _postStatus(TeacherActivityPost post) {
  if (post.attachments.any(
    (attachment) => attachment.processingStatus == 'FAILED',
  )) {
    return AppStatusType.rejected;
  }
  if (post.attachments.any(
    (attachment) => attachment.processingStatus == 'PENDING',
  )) {
    return AppStatusType.pending;
  }
  return post.status == 'APPROVED'
      ? AppStatusType.completed
      : AppStatusType.pending;
}

String _postStatusLabel(TeacherActivityPost post) {
  if (post.attachments.any(
    (attachment) => attachment.processingStatus == 'FAILED',
  )) {
    return 'Media retry';
  }
  if (post.attachments.any(
    (attachment) => attachment.processingStatus == 'PENDING',
  )) {
    return 'Preparing';
  }
  return post.status == 'APPROVED' ? 'Published' : 'In review';
}

String? _imageContentType(XFile file) {
  final mime = file.mimeType?.toLowerCase();
  if (mime != null &&
      const {
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif',
      }.contains(mime)) {
    return mime;
  }

  final name = file.name.toLowerCase();
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.heic')) return 'image/heic';
  if (name.endsWith('.heif')) return 'image/heif';
  return null;
}

String _newUuid() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes
      .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
      .join();
  return '${hex.substring(0, 8)}-'
      '${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-'
      '${hex.substring(16, 20)}-'
      '${hex.substring(20)}';
}

const _activityCategories = [
  ('GENERAL', 'General'),
  ('LEARNING', 'Learning'),
  ('OUTDOOR_PLAY', 'Outdoor play'),
  ('ART_AND_CRAFT', 'Art and craft'),
  ('CELEBRATION', 'Celebration'),
  ('SPORTS', 'Sports'),
];

const _milestoneStatuses = [
  ('EMERGING', 'Emerging'),
  ('PROGRESSING', 'Progressing'),
  ('ACHIEVED', 'Achieved'),
  ('NEEDS_SUPPORT', 'Needs support'),
];

import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/errors/app_exception.dart';
import '../../../../core/network/connectivity_provider.dart';
import '../../../../core/platform/file_share_service.dart';
import '../../../../shared/utils/money_format.dart';
import '../../../../shared/utils/nepali_bs_calendar.dart';
import '../../application/parent_providers.dart';
import '../../domain/parent_models.dart';
import '../../domain/parent_service_request_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentServiceRequestsScreen extends ConsumerStatefulWidget {
  const ParentServiceRequestsScreen({super.key});

  @override
  ConsumerState<ParentServiceRequestsScreen> createState() =>
      _ParentServiceRequestsScreenState();
}

class _ParentServiceRequestsScreenState
    extends ConsumerState<ParentServiceRequestsScreen> {
  final Set<String> _busyRequestIds = {};

  @override
  Widget build(BuildContext context) {
    final parentState = ref.watch(parentControllerProvider);
    final child = parentState.selectedChild;
    final isOnline = ref.watch(connectivityProvider);

    return ParentDetailScaffold(
      title: 'Help & Support',
      selectedIndex: 5,
      body: child == null
          ? const Center(
              child: Text('No active child is linked to this account.'),
            )
          : _body(parentState, child, isOnline),
    );
  }

  Widget _body(ParentState parentState, GuardianChild child, bool isOnline) {
    final requests = ref.watch(parentServiceRequestsProvider(child.id));
    final summary = ref.watch(parentDashboardSummaryProvider(child.id));
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(parentServiceRequestsProvider(child.id));
        ref.invalidate(parentDashboardSummaryProvider(child.id));
        await ref.read(parentServiceRequestsProvider(child.id).future);
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          ParentApiChildSelector(
            child: child,
            children: parentState.children,
            onChanged: (id) {
              ref.read(parentControllerProvider.notifier).selectChild(id);
            },
            statusLabel: isOnline ? null : 'Offline',
          ),
          const SizedBox(height: 14),
          if (!isOnline) ...[
            const PortalCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.cloud_off_outlined),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Requests contain private details and are not saved on this device. Reconnect to view or update them.',
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],
          PortalCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const FeatureIcon(Icons.support_agent_rounded),
                const SizedBox(height: 12),
                Text(
                  'Ask the school for help',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: ParentPortalColors.navy,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Raise a school concern or dispute a payment against the correct invoice. You can follow the response and confirm when it is resolved.',
                ),
                const SizedBox(height: 14),
                FilledButton.icon(
                  onPressed: isOnline
                      ? () => _openNewRequest(child, summary.valueOrNull)
                      : null,
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('New request'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const ParentSectionHeader(title: 'Recent requests'),
          const SizedBox(height: 10),
          if (!isOnline)
            const PortalCard(
              child: Text('Reconnect to load private request details.'),
            )
          else
            requests.when(
              loading: () => const PortalLoadingState(),
              error: (error, _) => PortalCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_safeError(error)),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: () => ref.invalidate(
                        parentServiceRequestsProvider(child.id),
                      ),
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Try again'),
                    ),
                  ],
                ),
              ),
              data: (data) => data.items.isEmpty
                  ? const PortalCard(
                      child: Text(
                        'No requests yet. New requests will appear here.',
                      ),
                    )
                  : Column(
                      children: [
                        for (final request in data.items) ...[
                          _RequestCard(
                            request: request,
                            busy: _busyRequestIds.contains(request.id),
                            onCancel: request.canCancel
                                ? () => _cancel(request, child.id)
                                : null,
                            onConfirm: request.canConfirmResolution
                                ? () => _confirmResolution(request, child.id)
                                : null,
                            onReopen: request.canReopen
                                ? () => _reopen(request, child.id)
                                : null,
                            onAddEvidence: request.canAddEvidence
                                ? () => _addEvidence(request, child.id)
                                : null,
                            onDownload: (attachment) =>
                                _download(request, attachment),
                          ),
                          const SizedBox(height: 12),
                        ],
                      ],
                    ),
            ),
        ],
      ),
    );
  }

  Future<void> _openNewRequest(
    GuardianChild child,
    ParentDashboardSummary? summary,
  ) async {
    final result = await showModalBottomSheet<_NewRequestResult>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _NewRequestSheet(
        child: child,
        invoices: summary?.recentInvoices ?? const [],
      ),
    );
    if (!mounted || result == null) return;
    ref.invalidate(parentServiceRequestsProvider(child.id));
    final message = result.evidenceUploaded
        ? 'Request and evidence sent to the school.'
        : result.evidenceSelected
        ? 'Request sent. The evidence could not be attached; open the request to try again.'
        : 'Request sent to the school.';
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _cancel(ParentServiceRequest request, String childId) async {
    final reason = await _promptReason(
      title: 'Cancel this request?',
      hint: 'Why are you cancelling it?',
    );
    if (reason == null) return;
    await _runAction(request.id, childId, () {
      return ref
          .read(parentRepositoryProvider)
          .cancelServiceRequest(requestId: request.id, reason: reason);
    });
  }

  Future<void> _confirmResolution(
    ParentServiceRequest request,
    String childId,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Confirm resolution?'),
        content: const Text(
          'Confirm only if the school response has resolved this request. The request will close, but it can be reopened for a limited time.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Not yet'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Confirm resolved'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _runAction(request.id, childId, () {
      return ref
          .read(parentRepositoryProvider)
          .confirmServiceRequestResolution(request.id);
    });
  }

  Future<void> _reopen(ParentServiceRequest request, String childId) async {
    final reason = await _promptReason(
      title: 'Reopen this request?',
      hint: 'What still needs attention?',
    );
    if (reason == null) return;
    await _runAction(request.id, childId, () {
      return ref
          .read(parentRepositoryProvider)
          .reopenServiceRequest(requestId: request.id, reason: reason);
    });
  }

  Future<void> _addEvidence(
    ParentServiceRequest request,
    String childId,
  ) async {
    final image = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 88,
    );
    if (image == null || !mounted) return;
    final contentType = _imageContentType(image.name);
    if (contentType == null) {
      _showMessage('Choose a JPG, PNG, or WebP image.');
      return;
    }
    final bytes = await image.readAsBytes();
    if (bytes.isEmpty || bytes.length > 5 * 1024 * 1024) {
      _showMessage('Choose an image up to 5 MB.');
      return;
    }
    await _runAction(request.id, childId, () {
      return ref
          .read(parentRepositoryProvider)
          .uploadServiceRequestEvidence(
            requestId: request.id,
            fileName: image.name,
            contentType: contentType,
            content: bytes,
            label: 'Parent evidence',
          );
    });
  }

  Future<void> _download(
    ParentServiceRequest request,
    ParentServiceRequestAttachment attachment,
  ) async {
    if (!ref.read(connectivityProvider)) {
      _showMessage('Reconnect to download protected evidence.');
      return;
    }
    try {
      final file = await ref
          .read(parentRepositoryProvider)
          .downloadServiceRequestEvidence(
            request: request,
            attachment: attachment,
          );
      await const FileShareService().shareFile(
        filePath: file.filePath,
        mimeType: attachment.mimeType,
        subject: 'School request evidence',
      );
    } catch (error) {
      _showMessage(_safeError(error));
    }
  }

  Future<void> _runAction(
    String requestId,
    String childId,
    Future<ParentServiceRequest> Function() action,
  ) async {
    if (!ref.read(connectivityProvider)) {
      _showMessage('This action needs internet. Please reconnect.');
      return;
    }
    if (_busyRequestIds.contains(requestId)) return;
    setState(() => _busyRequestIds.add(requestId));
    try {
      await action();
      ref.invalidate(parentServiceRequestsProvider(childId));
    } catch (error) {
      _showMessage(_safeError(error));
    } finally {
      if (mounted) setState(() => _busyRequestIds.remove(requestId));
    }
  }

  Future<String?> _promptReason({
    required String title,
    required String hint,
  }) async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          minLines: 2,
          maxLines: 4,
          maxLength: 500,
          decoration: InputDecoration(hintText: hint),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Back'),
          ),
          FilledButton(
            onPressed: () {
              final reason = controller.text.trim();
              if (reason.length >= 8) Navigator.pop(dialogContext, reason);
            },
            child: const Text('Continue'),
          ),
        ],
      ),
    );
    controller.dispose();
    return result;
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({
    required this.request,
    required this.busy,
    required this.onDownload,
    this.onCancel,
    this.onConfirm,
    this.onReopen,
    this.onAddEvidence,
  });

  final ParentServiceRequest request;
  final bool busy;
  final VoidCallback? onCancel;
  final VoidCallback? onConfirm;
  final VoidCallback? onReopen;
  final VoidCallback? onAddEvidence;
  final ValueChanged<ParentServiceRequestAttachment> onDownload;

  @override
  Widget build(BuildContext context) {
    return PortalCard(
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        childrenPadding: const EdgeInsets.only(bottom: 8),
        leading: FeatureIcon(
          request.isPaymentDispute
              ? Icons.receipt_long_outlined
              : Icons.support_agent_outlined,
          color: request.isOverdue
              ? ParentPortalColors.red
              : ParentPortalColors.purple,
        ),
        title: Text(
          request.subject,
          style: const TextStyle(fontWeight: FontWeight.w900),
        ),
        subtitle: Text(
          '${_requestTypeLabel(request.type)} • ${_statusLabel(request.status)}',
        ),
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    StatusBadge(label: _statusLabel(request.status)),
                    if (request.priority == 'HIGH')
                      const StatusBadge(label: 'High priority'),
                    if (request.isOverdue)
                      const StatusBadge(label: 'Response overdue'),
                  ],
                ),
                const SizedBox(height: 12),
                Text(request.description),
                const SizedBox(height: 10),
                Text(
                  'Response due ${NepaliBsCalendar.formatBsDateTime(request.responseDeadline)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                if (request.responderName != null)
                  Text(
                    'School contact: ${request.responderName}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                if (request.invoice != null) ...[
                  const Divider(height: 24),
                  Text(
                    '${request.invoice!.invoiceNumber} • ${formatMoney(request.invoice!.totalAmount)}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  Text(
                    'Invoice due ${NepaliBsCalendar.formatBsDate(request.invoice!.dueDate)}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
                if (request.resolutionSummary != null) ...[
                  const Divider(height: 24),
                  const Text(
                    'School response',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text(request.resolutionSummary!),
                ],
                if (request.notes.isNotEmpty) ...[
                  const Divider(height: 24),
                  const Text(
                    'Updates',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  for (final note in request.notes)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      title: Text(note.body),
                      subtitle: Text(
                        '${note.author} • ${NepaliBsCalendar.formatBsDateTime(note.createdAt)}',
                      ),
                    ),
                ],
                if (request.attachments.isNotEmpty) ...[
                  const Divider(height: 24),
                  const Text(
                    'Evidence',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  for (final attachment in request.attachments)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      leading: const Icon(Icons.attachment_rounded),
                      title: Text(attachment.label ?? attachment.fileName),
                      subtitle: Text(_fileSize(attachment.sizeBytes)),
                      trailing: IconButton(
                        tooltip: 'Open protected evidence',
                        onPressed: busy ? null : () => onDownload(attachment),
                        icon: const Icon(Icons.download_rounded),
                      ),
                    ),
                ],
                const SizedBox(height: 10),
                if (busy) const LinearProgressIndicator(),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (onAddEvidence != null)
                      OutlinedButton.icon(
                        onPressed: busy ? null : onAddEvidence,
                        icon: const Icon(Icons.add_photo_alternate_outlined),
                        label: const Text('Add evidence'),
                      ),
                    if (onCancel != null)
                      TextButton(
                        onPressed: busy ? null : onCancel,
                        child: const Text('Cancel request'),
                      ),
                    if (onConfirm != null)
                      FilledButton(
                        onPressed: busy ? null : onConfirm,
                        child: const Text('Confirm resolved'),
                      ),
                    if (onReopen != null)
                      OutlinedButton(
                        onPressed: busy ? null : onReopen,
                        child: const Text('Reopen'),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NewRequestSheet extends ConsumerStatefulWidget {
  const _NewRequestSheet({required this.child, required this.invoices});

  final GuardianChild child;
  final List<ParentFeeInvoice> invoices;

  @override
  ConsumerState<_NewRequestSheet> createState() => _NewRequestSheetState();
}

class _NewRequestSheetState extends ConsumerState<_NewRequestSheet> {
  final _formKey = GlobalKey<FormState>();
  final _subjectController = TextEditingController();
  final _descriptionController = TextEditingController();
  String _type = 'GENERAL_COMPLAINT';
  String _category = 'OTHER';
  String _priority = 'NORMAL';
  String? _invoiceId;
  XFile? _evidence;
  bool _submitting = false;
  String? _error;
  String? _idempotencyKey;

  @override
  void dispose() {
    _subjectController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final paymentDispute = _type == 'PAYMENT_DISPUTE';
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        12,
        20,
        MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'New request for ${widget.child.name}',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 6),
              const Text(
                'The school will receive the child, category, response deadline, and any evidence you attach.',
              ),
              const SizedBox(height: 18),
              DropdownButtonFormField<String>(
                initialValue: _type,
                decoration: const InputDecoration(labelText: 'Request type'),
                items: const [
                  DropdownMenuItem(
                    value: 'GENERAL_COMPLAINT',
                    child: Text('School concern'),
                  ),
                  DropdownMenuItem(
                    value: 'PAYMENT_DISPUTE',
                    child: Text('Payment dispute'),
                  ),
                ],
                onChanged: _submitting
                    ? null
                    : (value) => setState(() {
                        _type = value ?? 'GENERAL_COMPLAINT';
                        if (_type == 'PAYMENT_DISPUTE') {
                          _category = 'FEES_AND_PAYMENTS';
                        }
                      }),
              ),
              const SizedBox(height: 12),
              if (paymentDispute)
                DropdownButtonFormField<String>(
                  initialValue: _invoiceId,
                  decoration: const InputDecoration(
                    labelText: 'Invoice',
                    helperText:
                        'A dispute never changes the invoice or payment by itself.',
                  ),
                  items: [
                    for (final invoice in widget.invoices)
                      DropdownMenuItem(
                        value: invoice.id,
                        child: Text(
                          '${invoice.invoiceNumber} • ${formatMoney(invoice.totalAmount)}',
                        ),
                      ),
                  ],
                  validator: (value) => value == null || value.isEmpty
                      ? 'Choose the related invoice.'
                      : null,
                  onChanged: _submitting
                      ? null
                      : (value) => setState(() => _invoiceId = value),
                )
              else
                DropdownButtonFormField<String>(
                  initialValue: _category,
                  decoration: const InputDecoration(labelText: 'Category'),
                  items: const [
                    DropdownMenuItem(
                      value: 'ACADEMICS',
                      child: Text('Academics'),
                    ),
                    DropdownMenuItem(
                      value: 'ATTENDANCE',
                      child: Text('Attendance'),
                    ),
                    DropdownMenuItem(
                      value: 'SCHOOL_OPERATIONS',
                      child: Text('School operations'),
                    ),
                    DropdownMenuItem(value: 'OTHER', child: Text('Other')),
                  ],
                  onChanged: _submitting
                      ? null
                      : (value) => setState(() => _category = value ?? 'OTHER'),
                ),
              if (paymentDispute && widget.invoices.isEmpty) ...[
                const SizedBox(height: 8),
                const Text(
                  'No eligible invoice is available for this child. Refresh Fees & Receipts or ask the school office.',
                  style: TextStyle(color: ParentPortalColors.red),
                ),
              ],
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _priority,
                decoration: const InputDecoration(labelText: 'Priority'),
                items: const [
                  DropdownMenuItem(value: 'NORMAL', child: Text('Normal')),
                  DropdownMenuItem(value: 'HIGH', child: Text('High')),
                ],
                onChanged: _submitting
                    ? null
                    : (value) => setState(() => _priority = value ?? 'NORMAL'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _subjectController,
                enabled: !_submitting,
                maxLength: 120,
                decoration: const InputDecoration(labelText: 'Subject'),
                validator: (value) {
                  final length = value?.trim().length ?? 0;
                  return length < 3 ? 'Enter at least 3 characters.' : null;
                },
              ),
              TextFormField(
                controller: _descriptionController,
                enabled: !_submitting,
                minLines: 4,
                maxLines: 8,
                maxLength: 2000,
                decoration: const InputDecoration(
                  labelText: 'What happened?',
                  alignLabelWithHint: true,
                ),
                validator: (value) {
                  final length = value?.trim().length ?? 0;
                  return length < 10 ? 'Enter at least 10 characters.' : null;
                },
              ),
              OutlinedButton.icon(
                onPressed: _submitting ? null : _chooseEvidence,
                icon: const Icon(Icons.add_photo_alternate_outlined),
                label: Text(
                  _evidence == null
                      ? 'Add photo evidence (optional)'
                      : 'Photo: ${_evidence!.name}',
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 10),
                Text(
                  _error!,
                  style: const TextStyle(color: ParentPortalColors.red),
                ),
              ],
              if (_submitting) ...[
                const SizedBox(height: 12),
                const LinearProgressIndicator(),
              ],
              const SizedBox(height: 18),
              Row(
                children: [
                  TextButton(
                    onPressed: _submitting
                        ? null
                        : () => Navigator.pop(context),
                    child: const Text('Back'),
                  ),
                  const Spacer(),
                  FilledButton.icon(
                    onPressed:
                        _submitting ||
                            (paymentDispute && widget.invoices.isEmpty)
                        ? null
                        : _submit,
                    icon: const Icon(Icons.send_rounded),
                    label: const Text('Send request'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _chooseEvidence() async {
    final image = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 88,
    );
    if (image == null || !mounted) return;
    final contentType = _imageContentType(image.name);
    final bytes = await image.readAsBytes();
    if (contentType == null ||
        bytes.isEmpty ||
        bytes.length > 5 * 1024 * 1024) {
      setState(() {
        _error = 'Choose a JPG, PNG, or WebP image up to 5 MB.';
      });
      return;
    }
    setState(() {
      _evidence = image;
      _error = null;
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (!ref.read(connectivityProvider)) {
      setState(() => _error = 'Reconnect before sending this request.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final key = _idempotencyKey ??= _newUuidV4();
    try {
      final repository = ref.read(parentRepositoryProvider);
      final request = await repository.createServiceRequest(
        childId: widget.child.id,
        type: _type,
        category: _type == 'PAYMENT_DISPUTE' ? 'FEES_AND_PAYMENTS' : _category,
        priority: _priority,
        subject: _subjectController.text.trim(),
        description: _descriptionController.text.trim(),
        invoiceId: _type == 'PAYMENT_DISPUTE' ? _invoiceId : null,
        idempotencyKey: key,
      );
      var evidenceUploaded = false;
      if (_evidence != null) {
        try {
          final bytes = await _evidence!.readAsBytes();
          await repository.uploadServiceRequestEvidence(
            requestId: request.id,
            fileName: _evidence!.name,
            contentType: _imageContentType(_evidence!.name)!,
            content: bytes,
            label: 'Parent evidence',
          );
          evidenceUploaded = true;
        } catch (_) {
          evidenceUploaded = false;
        }
      }
      if (!mounted) return;
      Navigator.pop(
        context,
        _NewRequestResult(
          evidenceSelected: _evidence != null,
          evidenceUploaded: evidenceUploaded,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = _safeError(error);
      });
    }
  }
}

class _NewRequestResult {
  const _NewRequestResult({
    required this.evidenceSelected,
    required this.evidenceUploaded,
  });

  final bool evidenceSelected;
  final bool evidenceUploaded;
}

String _requestTypeLabel(String value) =>
    value == 'PAYMENT_DISPUTE' ? 'Payment dispute' : 'School concern';

String _statusLabel(String value) {
  return switch (value) {
    'OPEN' => 'Open',
    'ASSIGNED' => 'Assigned',
    'IN_PROGRESS' => 'In progress',
    'RESOLVED' => 'Resolved',
    'CLOSED' => 'Closed',
    'REOPENED' => 'Reopened',
    'CANCELLED' => 'Cancelled',
    _ => 'Status unavailable',
  };
}

String? _imageContentType(String name) {
  final lower = name.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return null;
}

String _fileSize(int bytes) {
  if (bytes >= 1024 * 1024) {
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
  return '${max(1, (bytes / 1024).ceil())} KB';
}

String _safeError(Object error) {
  if (error is AppException) return error.message;
  return 'This request could not be completed. Please try again.';
}

String _newUuidV4() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes
      .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
      .join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
      '${hex.substring(20)}';
}

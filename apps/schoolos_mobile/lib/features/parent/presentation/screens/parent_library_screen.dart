import 'package:flutter/material.dart';
import '../../domain/parent_feature_models.dart';
import '../widgets/parent_detail_widgets.dart';
import '../widgets/parent_portal_widgets.dart';

class ParentLibraryScreen extends StatefulWidget {
  const ParentLibraryScreen({super.key});
  @override
  State<ParentLibraryScreen> createState() => _ParentLibraryScreenState();
}

class _ParentLibraryScreenState extends State<ParentLibraryScreen> {
  ChildProfile child = parentChildren.last;
  List<LibraryLoan> get loans => child.id == 'aarohi'
      ? const [
          LibraryLoan(
            title: 'My First Phonics Book',
            due: 'Fri, 24 May',
            dueLabel: 'Due in 3 days',
            color: ParentPortalColors.blue,
          ),
          LibraryLoan(
            title: 'Animals Around Us',
            due: 'Tue, 28 May',
            dueLabel: 'Due in 7 days',
            color: ParentPortalColors.green,
          ),
        ]
      : const [
          LibraryLoan(
            title: 'My First Numbers',
            due: 'Mon, 27 May',
            dueLabel: 'Due in 6 days',
            color: ParentPortalColors.orange,
          ),
        ];
  @override
  Widget build(BuildContext context) => ParentDetailScaffold(
    title: 'Library',
    selectedIndex: 4,
    body: ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
      children: [
        ParentChildSelector(
          child: child,
          onChanged: (value) => setState(() => child = value),
        ),
        const SizedBox(height: 14),
        PortalCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ParentSectionHeader(title: 'Library summary'),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: _LibraryMetric(
                      Icons.menu_book_rounded,
                      '${loans.length}',
                      'books borrowed',
                      ParentPortalColors.green,
                    ),
                  ),
                  const Expanded(
                    child: _LibraryMetric(
                      Icons.schedule_rounded,
                      '1',
                      'due soon',
                      ParentPortalColors.orange,
                    ),
                  ),
                  const Expanded(
                    child: _LibraryMetric(
                      Icons.error_rounded,
                      '0',
                      'overdue',
                      ParentPortalColors.red,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const ParentSectionHeader(title: 'Currently borrowed'),
        const SizedBox(height: 8),
        for (final loan in loans) ...[
          PortalCard(
            onTap: () => _loanDetail(context, loan),
            child: Row(
              children: [
                _BookCover(loan: loan),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        loan.title,
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Due: ${loan.due}',
                        style: const TextStyle(
                          color: ParentPortalColors.blue,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 7),
                      StatusBadge(
                        label: loan.dueLabel,
                        color: loan.color,
                        background: loan.color.withValues(alpha: .1),
                      ),
                    ],
                  ),
                ),
                const ListChevron(),
              ],
            ),
          ),
          const SizedBox(height: 10),
        ],
        const SizedBox(height: 8),
        const ParentSectionHeader(title: 'Reading activity'),
        const SizedBox(height: 8),
        PortalCard(
          child: Column(
            children: [
              const ListTile(
                contentPadding: EdgeInsets.zero,
                leading: FeatureIcon(
                  Icons.menu_book_rounded,
                  color: ParentPortalColors.green,
                ),
                title: Text('Books returned this term'),
                subtitle: Text(
                  '5',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                ),
              ),
              const Divider(),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const FeatureIcon(Icons.person_rounded),
                title: const Text('Note from librarian'),
                subtitle: Text(
                  '${child.name.split(' ').first} enjoys picture books.',
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () => _history(context),
          icon: const Icon(Icons.history_rounded),
          label: const Text('View library history'),
        ),
      ],
    ),
  );
  void _loanDetail(BuildContext context, LibraryLoan loan) =>
      showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        builder: (_) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _BookCover(loan: loan, large: true),
                const SizedBox(height: 12),
                Text(
                  loan.title,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  'Borrowed by ${child.name}\nDue ${loan.due}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: ParentPortalColors.muted),
                ),
                const SizedBox(height: 10),
                StatusBadge(
                  label: loan.dueLabel,
                  color: loan.color,
                  background: loan.color.withValues(alpha: .1),
                ),
              ],
            ),
          ),
        ),
      );
  void _history(BuildContext context) => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (_) => const SafeArea(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Library history',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
            ),
            ListTile(
              leading: Icon(
                Icons.check_circle,
                color: ParentPortalColors.green,
              ),
              title: Text('The Very Hungry Caterpillar'),
              subtitle: Text('Returned 12 May'),
            ),
            ListTile(
              leading: Icon(
                Icons.check_circle,
                color: ParentPortalColors.green,
              ),
              title: Text('Shapes Around Me'),
              subtitle: Text('Returned 28 April'),
            ),
          ],
        ),
      ),
    ),
  );
}

class _LibraryMetric extends StatelessWidget {
  const _LibraryMetric(this.icon, this.value, this.label, this.color);
  final IconData icon;
  final String value, label;
  final Color color;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      FeatureIcon(icon, color: color, size: 44),
      const SizedBox(height: 6),
      Text(
        value,
        style: const TextStyle(fontSize: 25, fontWeight: FontWeight.w900),
      ),
      Text(
        label,
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 11, color: ParentPortalColors.muted),
      ),
    ],
  );
}

class _BookCover extends StatelessWidget {
  const _BookCover({required this.loan, this.large = false});
  final LibraryLoan loan;
  final bool large;
  @override
  Widget build(BuildContext context) => Container(
    width: large ? 130 : 86,
    height: large ? 160 : 110,
    padding: const EdgeInsets.all(9),
    decoration: BoxDecoration(
      color: loan.color,
      borderRadius: BorderRadius.circular(10),
      boxShadow: [
        BoxShadow(
          color: loan.color.withValues(alpha: .25),
          blurRadius: 8,
          offset: const Offset(0, 4),
        ),
      ],
    ),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.auto_stories_rounded, color: Colors.white),
        Text(
          loan.title,
          maxLines: large ? 4 : 3,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w900,
            fontSize: large ? 16 : 11,
          ),
        ),
        if (large)
          Align(
            alignment: Alignment.bottomRight,
            child: Container(
              width: 22,
              height: 22,
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.star_rounded, color: loan.color, size: 15),
            ),
          ),
      ],
    ),
  );
}

import '../domain/parent_portal_models.dart';

/// Replaceable local source for the parent portal visual slice.
///
/// Keeping the screen contract behind a repository allows the same providers
/// to move to purpose-limited mobile API DTOs without changing presentation.
class ParentPortalMockRepository {
  const ParentPortalMockRepository();

  Future<ParentPortalData> load() async {
    return const ParentPortalData(
      parentName: 'Erwin Shrestha',
      schoolName: 'Greenfield Academy',
      lastUpdated: '6:19 PM',
      children: [
        ParentPortalChild(
          id: 'aarav',
          name: 'Aarav Shrestha',
          classSection: 'Nursery-A',
          teacher: 'Ms. Priya Sharma',
          attendance: 'Present today',
          attendanceTime: 'Checked in at 8:42 AM',
          transport: 'Pickup at 3:15 PM • Gate 2',
          homework: 'No homework due today',
          updates: '1 new class update',
        ),
        ParentPortalChild(
          id: 'aarohi',
          name: 'Aarohi Shrestha',
          classSection: 'LKG-A',
          teacher: 'Ms. Kavita Rai',
          attendance: 'Present today',
          attendanceTime: 'Checked in at 8:38 AM',
          transport: 'Guardian pickup • 3:15 PM',
          homework: '1 homework due tomorrow',
          updates: '1 unread notice',
        ),
      ],
      homework: [
        ParentPortalHomework(
          id: 'phonics',
          childName: 'Aarohi Shrestha',
          classSection: 'LKG-A',
          subject: 'English',
          title: 'Read the phonics worksheet',
          dueLabel: 'Due tomorrow, 8:00 AM',
          status: 'Pending',
          attachmentCount: 1,
          teacher: 'Ms. Sita Sharma',
        ),
        ParentPortalHomework(
          id: 'fruit',
          childName: 'Aarav Shrestha',
          classSection: 'Nursery-A',
          subject: 'Creative Work',
          title: 'Color the fruit worksheet',
          dueLabel: 'Due Monday, 9:00 AM',
          status: 'Pending',
          attachmentCount: 2,
          teacher: 'Ms. Priya Sharma',
        ),
        ParentPortalHomework(
          id: 'plant-life',
          childName: 'Aarohi Shrestha',
          classSection: 'LKG-A',
          subject: 'Science',
          title: 'Plant life worksheet',
          dueLabel: 'Submitted Wednesday',
          status: 'Completed',
          attachmentCount: 1,
          teacher: 'Mr. Ramesh Poudel',
        ),
      ],
      updates: [
        ParentPortalUpdate(
          id: 'holiday',
          category: ParentUpdateCategory.notice,
          title: 'Holiday notice for Friday',
          body: 'School will remain closed for the local public holiday.',
          metadata: 'School-wide • Today, 4:30 PM',
          isPinned: true,
          isImportant: true,
        ),
        ParentPortalUpdate(
          id: 'teacher-message',
          category: ParentUpdateCategory.message,
          title: 'Ms. Sita Sharma',
          body: 'Please check Aarohi’s English homework.',
          metadata: 'Aarohi • 25 minutes ago',
          unreadCount: 1,
        ),
        ParentPortalUpdate(
          id: 'ptm',
          category: ParentUpdateCategory.event,
          title: 'Parent–Teacher Meeting',
          body: 'Friday, 10:00 AM–2:00 PM',
          metadata: 'For Aarohi, LKG-A',
        ),
        ParentPortalUpdate(
          id: 'science-gallery',
          category: ParentUpdateCategory.gallery,
          title: 'Grade 5 Science activity photos',
          body: '6 new approved photos',
          metadata: 'School gallery • Yesterday',
        ),
      ],
    );
  }
}

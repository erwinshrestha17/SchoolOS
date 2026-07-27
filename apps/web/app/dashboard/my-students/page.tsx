import { MyStudentsTabs } from '@/components/students/my-students-tabs';
import { ModuleHeader } from '@/components/ui/module-header';

export const metadata = {
  title: 'My Students | SchoolOS',
  description: 'Students in your assigned homeroom and subject sections.',
};

export default function MyStudentsPage() {
  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
      <ModuleHeader
        eyebrow="My Teaching"
        title="My Students"
        description="Your subject classes and, if you are a Class Teacher, your homeroom."
      />
      {/* Subject responsibilities and homeroom responsibilities are genuinely
          different scopes with different rights, so they are separate views
          rather than one merged list. */}
      <MyStudentsTabs />
    </div>
  );
}

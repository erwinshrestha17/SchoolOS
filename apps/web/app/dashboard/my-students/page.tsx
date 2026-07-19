import { MyStudentsWorkspace } from '@/components/students/my-students-workspace';
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
        description="Students in your assigned homeroom and subject sections."
      />
      <MyStudentsWorkspace />
    </div>
  );
}

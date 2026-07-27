'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { GraduationCap, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { WorkspaceTabs } from '@/components/ui/module-tabs';
import { MyStudentsWorkspace } from './my-students-workspace';
import { HomeroomAcademicSummary } from './homeroom-academic-summary';

type StudentsTab = 'subjects' | 'homeroom';

/**
 * Splits "My Students" along the authorization boundary that actually exists
 * (assignment-based access-control spec, "My Students"):
 *
 *   My Subject Students — the sections you teach, with write access to your
 *                         own subject's records.
 *   My Homeroom         — cross-subject read for the section you are Class
 *                         Teacher of, plus homeroom-record write.
 *
 * The Homeroom tab is hidden entirely when the teacher holds no CLASS_TEACHER
 * assignment, rather than shown and then refused.
 */
export function MyStudentsTabs() {
  const [tab, setTab] = useState<StudentsTab>('subjects');

  const homeroomsQuery = useQuery({
    queryKey: ['teacher-homerooms'],
    queryFn: () => api.getMyHomerooms(),
    staleTime: 5 * 60_000,
  });

  const hasHomeroom = (homeroomsQuery.data?.length ?? 0) > 0;

  if (!hasHomeroom) {
    return <MyStudentsWorkspace />;
  }

  return (
    <div className="space-y-6">
      <WorkspaceTabs
        label="Student views"
        activeValue={tab}
        onValueChange={(value) => setTab(value as StudentsTab)}
        items={[
          {
            value: 'subjects',
            label: 'My Subject Students',
            icon: GraduationCap,
          },
          { value: 'homeroom', label: 'My Homeroom', icon: Users },
        ]}
      />
      {tab === 'subjects' ? (
        <MyStudentsWorkspace />
      ) : (
        <HomeroomAcademicSummary />
      )}
    </div>
  );
}

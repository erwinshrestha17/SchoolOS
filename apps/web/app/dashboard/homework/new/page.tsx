'use client';

import { PageHeader } from '@/components/ui/page-header';
import { HomeworkCreateForm } from '@/components/homework/homework-create-form';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewHomeworkPage() {
  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <Tooltip content="Back to homework">
          <Link href="/dashboard/homework">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back to homework"
              className="rounded-full h-10 w-10"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
        </Tooltip>
        <PageHeader
          title="Create Homework"
          description="Design a new assignment for your students. You can publish it immediately or save it as a draft."
        />
      </div>

      <HomeworkCreateForm />
    </div>
  );
}

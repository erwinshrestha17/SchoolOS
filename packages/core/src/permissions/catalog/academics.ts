export const academicsPermissions = [
  {
    resource: "classes",
    action: "create",
    description: "Create classes inside a tenant",
  },
  {
    resource: "classes",
    action: "read",
    description: "Read classes inside a tenant",
  },
  {
    resource: "academic_years",
    action: "create",
    description: "Create academic years inside a tenant",
  },
  {
    resource: "academic_years",
    action: "read",
    description: "Read academic years inside a tenant",
  },
  {
    resource: "sections",
    action: "create",
    description: "Create sections inside a tenant",
  },
  {
    resource: "sections",
    action: "read",
    description: "Read sections inside a tenant",
  },
  {
    resource: "academics",
    action: "manage",
    description: "Manage subjects, exams, CAS, marks, and report cards",
  },
  {
    resource: "academics",
    action: "read",
    description: "Read academic setup, marks, CAS, and report cards",
  },
  {
    resource: "academics",
    action: "enter_marks",
    description: "Enter and update academic marks and CAS records",
  },
  {
    resource: "academics",
    action: "manage_report_cards",
    description: "Generate, lock, and publish academic report cards",
  },
  {
    resource: "academics",
    action: "create",
    description: "Create academic entities like terms and assessment components",
  },
  {
    resource: "academics",
    action: "update",
    description: "Update academic setup and assessment configurations",
  },
  {
    resource: "academics",
    action: "delete",
    description: "Delete academic setup records",
  },
  {
    resource: "exam-terms",
    action: "read",
    description: "Read exam terms",
  },
  {
    resource: "exam-terms",
    action: "manage",
    description: "Manage exam terms",
  },
  {
    resource: "assessment-components",
    action: "read",
    description: "Read assessment components",
  },
  {
    resource: "assessment-components",
    action: "manage",
    description: "Manage assessment components",
  },
  {
    resource: "marks",
    action: "read",
    description: "Read marks",
  },
  {
    resource: "marks",
    action: "manage",
    description: "Manage marks",
  },
  {
    resource: "academics:cas",
    action: "manage",
    description: "Manage CAS assessments and records",
  },
  {
    resource: "cas-records",
    action: "read",
    description: "Read CAS records",
  },
  {
    resource: "cas-records",
    action: "manage",
    description: "Manage CAS records",
  },
  {
    resource: "results",
    action: "read",
    description: "Read result previews and grading scale",
  },
  {
    resource: "timetable",
    action: "manage",
    description: "Manage teacher availability, workload limits, and setup workflows",
  },
  {
    resource: "timetable",
    action: "read",
    description: "Read timetable slots and teacher workload schedules",
  },
  {
    resource: "timetable",
    action: "create",
    description: "Create timetable periods, rooms, versions, and slots",
  },
  {
    resource: "timetable",
    action: "update",
    description: "Update draft timetable setup records and slots",
  },
  {
    resource: "timetable",
    action: "delete",
    description: "Delete draft timetable setup records and slots",
  },
  {
    resource: "timetable",
    action: "publish",
    description: "Publish, lock, archive, and reopen timetable versions",
  },
  {
    resource: "timetable",
    action: "substitute",
    description: "Manage absent-teacher substitution workflows",
  },
  {
    resource: "homework",
    action: "create",
    description: "Publish homework assignments to class and student audiences",
  },
  {
    resource: "homework",
    action: "read",
    description: "Read homework assignments and submissions",
  },
  {
    resource: "homework",
    action: "review",
    description: "Review homework submissions and scores",
  },
  {
    resource: "homework",
    action: "update",
    description: "Update homework assignments and submission status",
  },
  {
    resource: "homework",
    action: "delete",
    description: "Delete or cancel homework assignments",
  },
  {
    resource: "homework",
    action: "notify",
    description: "Preview and send homework reminders",
  },
  {
    resource: "homework",
    action: "submit",
    description: "Submit homework assignments as a student",
  },
] as const;

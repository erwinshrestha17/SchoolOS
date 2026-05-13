import {
  ActivityCategory,
  AttendanceStatus,
  AudienceType,
  ConsentType,
  ContractType,
  Gender,
  InvoiceStatus,
  NoticePriority,
  NotificationChannel,
  NotificationStatus,
  PaymentMethod,
  Prisma,
  PrismaClient,
} from '@prisma/client';

type UserMap = Map<string, { id: string }>;
type DemoStudent = {
  id: string;
  studentSystemId: string;
  classId: string;
  sectionId: string;
  firstNameEn: string;
  lastNameEn: string;
};
type DemoGuardian = { id: string; userId: string | null; primaryPhone: string };
type DemoStudentRow = { student: DemoStudent; guardian: DemoGuardian; className: string };
type DemoNotice = { id: string; title: string; body: string; audienceType: AudienceType };
type DemoPost = { id: string; title: string; caption: string; audienceType: AudienceType };

export async function seedDemoSchoolData(
  prisma: PrismaClient,
  tenantId: string,
  academicYearId: string,
) {
  console.log('Seeding demo school operational data...');

  const users = await getUsers(prisma, tenantId);
  await seedStaff(prisma, tenantId, users);
  await seedSubjects(prisma, tenantId, academicYearId, users);
  const students = await seedStudentsAndGuardians(prisma, tenantId, academicYearId, users);
  await seedFees(prisma, tenantId, academicYearId, users, students);
  await seedAttendance(prisma, tenantId, academicYearId, users, students);
  const notices = await seedNotices(prisma, tenantId, users);
  const posts = await seedActivityPosts(prisma, tenantId, users, students);
  await seedDeliveries(prisma, tenantId, notices, posts, students);
  await seedConsents(prisma, tenantId, students);

  console.log(
    `✅ Demo school data seeded: ${students.length} students with guardians, staff, fees, attendance, notices, activity, and consents.`,
  );
}

async function getUsers(prisma: PrismaClient, tenantId: string): Promise<UserMap> {
  const users: UserMap = new Map();
  const emails = [
    'principal@schoolos.com',
    'accountant@schoolos.com',
    'classteacher@schoolos.com',
    'subjectteacher@schoolos.com',
    'guardian@schoolos.com',
    'student@schoolos.com',
  ];

  for (const email of emails) {
    const user = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
      select: { id: true },
    });
    if (user) users.set(email, user);
  }

  return users;
}

async function seedStaff(prisma: PrismaClient, tenantId: string, users: UserMap) {
  const rows = [
    ['principal@schoolos.com', 'EMP-DEMO-001', 'Anita', 'Sharma', Gender.FEMALE, '1982-01-10', 'Principal'],
    ['accountant@schoolos.com', 'EMP-DEMO-002', 'Suresh', 'Koirala', Gender.MALE, '1988-06-18', 'Accountant'],
    ['classteacher@schoolos.com', 'EMP-DEMO-003', 'Mina', 'Gautam', Gender.FEMALE, '1991-03-22', 'Class Teacher'],
    ['subjectteacher@schoolos.com', 'EMP-DEMO-004', 'Rajesh', 'Aryal', Gender.MALE, '1989-10-05', 'Subject Teacher'],
  ] as const;

  for (const [email, employeeId, firstName, lastName, gender, dob, role] of rows) {
    const user = users.get(email);
    if (!user) continue;

    const data = {
      tenantId,
      userId: user.id,
      employeeId,
      firstName,
      lastName,
      dateOfBirth: date(dob),
      gender,
      address: 'Demo Address, Nepal',
      teacherRegistryId: role.includes('Teacher') || role === 'Principal' ? `NTR-${employeeId}` : null,
      panNumber: `PAN-${employeeId}`,
      bankAccount: `BANK-${employeeId}`,
      bankName: 'Demo Bank',
      qualifications: `${role} qualification`,
      experience: `${role} demo profile`,
      joiningDate: date('2020-04-01'),
      contractType: ContractType.PERMANENT,
      privacyConsentAt: new Date(),
    };

    await prisma.staff.upsert({
      where: { tenantId_employeeId: { tenantId, employeeId } },
      update: data,
      create: data,
    });
  }
}

async function seedSubjects(
  prisma: PrismaClient,
  tenantId: string,
  academicYearId: string,
  users: UserMap,
) {
  const classTeacher = await staffByEmail(prisma, tenantId, users, 'classteacher@schoolos.com');
  const subjectTeacher = await staffByEmail(prisma, tenantId, users, 'subjectteacher@schoolos.com');
  const subjects = [
    ['ENG', 'English', false],
    ['NEP', 'Nepali', false],
    ['MATH', 'Mathematics', false],
    ['SCI', 'Science', true],
    ['SOC', 'Social Studies', false],
    ['COMP', 'Computer Science', true],
  ] as const;

  for (const className of ['Class 1', 'Class 8', 'Class 10']) {
    const classroom = await findClass(prisma, tenantId, className);
    const section = await findSection(prisma, tenantId, classroom.id, 'A');

    for (const [code, name, hasPractical] of subjects) {
      const subject = await prisma.subject.upsert({
        where: { tenantId_classId_code: { tenantId, classId: classroom.id, code } },
        update: {
          name,
          type: 'Core',
          hasPractical,
          theoryMarks: hasPractical ? 75 : 100,
          practicalMarks: hasPractical ? 25 : null,
          passMarks: 35,
        },
        create: {
          tenantId,
          classId: classroom.id,
          code,
          name,
          type: 'Core',
          hasPractical,
          theoryMarks: hasPractical ? 75 : 100,
          practicalMarks: hasPractical ? 25 : null,
          passMarks: 35,
        },
      });

      const staffId = className === 'Class 1' ? classTeacher?.id : subjectTeacher?.id;
      if (!staffId || !['ENG', 'NEP', 'MATH', 'SCI'].includes(code)) continue;

      const existing = await prisma.subjectTeacherAssignment.findFirst({
        where: { tenantId, academicYearId, classId: classroom.id, sectionId: section.id, subjectId: subject.id, staffId },
      });
      if (!existing) {
        await prisma.subjectTeacherAssignment.create({
          data: { tenantId, academicYearId, classId: classroom.id, sectionId: section.id, subjectId: subject.id, staffId },
        });
      }
    }
  }
}

async function seedStudentsAndGuardians(
  prisma: PrismaClient,
  tenantId: string,
  academicYearId: string,
  users: UserMap,
): Promise<DemoStudentRow[]> {
  const parentUser = users.get('guardian@schoolos.com');
  const studentUser = users.get('student@schoolos.com');
  const rows = [
    ['SCH-2026-0001', 'Aarav', 'Shrestha', Gender.MALE, 'Nursery', 'A', 1, 'Demo Guardian A', 'demo-phone-001', true, false],
    ['SCH-2026-0002', 'Aarohi', 'Shrestha', Gender.FEMALE, 'LKG', 'A', 2, 'Demo Guardian A', 'demo-phone-001', true, false],
    ['SCH-2026-0003', 'Niva', 'Khadka', Gender.FEMALE, 'UKG', 'A', 3, 'Demo Guardian B', 'demo-phone-003', false, false],
    ['SCH-2026-0004', 'Samir', 'Gurung', Gender.MALE, 'Class 1', 'A', 4, 'Demo Guardian C', 'demo-phone-004', false, false],
    ['SCH-2026-0005', 'Prisha', 'Adhikari', Gender.FEMALE, 'Class 1', 'A', 5, 'Demo Guardian D', 'demo-phone-005', false, false],
    ['SCH-2026-0006', 'Kiran', 'Thapa', Gender.MALE, 'Class 5', 'A', 6, 'Demo Guardian E', 'demo-phone-006', false, false],
    ['SCH-2026-0007', 'Rohan', 'Yadav', Gender.MALE, 'Class 8', 'A', 7, 'Demo Guardian F', 'demo-phone-007', false, true],
    ['SCH-2026-0008', 'Sneha', 'Bhattarai', Gender.FEMALE, 'Class 8', 'A', 8, 'Demo Guardian G', 'demo-phone-008', false, false],
    ['SCH-2026-0009', 'Bibek', 'Rana', Gender.MALE, 'Class 10', 'A', 9, 'Demo Guardian H', 'demo-phone-009', false, false],
    ['SCH-2026-0010', 'Asmita', 'Karki', Gender.FEMALE, 'Class 10', 'A', 10, 'Demo Guardian I', 'demo-phone-010', false, false],
  ] as const;
  const seeded: DemoStudentRow[] = [];

  for (const [studentSystemId, firstNameEn, lastNameEn, gender, className, sectionName, rollNumber, guardianName, phone, linkParent, linkStudent] of rows) {
    const classroom = await findClass(prisma, tenantId, className);
    const section = await findSection(prisma, tenantId, classroom.id, sectionName);
    const userId = linkStudent && studentUser ? studentUser.id : null;

    const student = await prisma.student.upsert({
      where: { tenantId_studentSystemId: { tenantId, studentSystemId } },
      update: {
        userId,
        firstNameEn,
        lastNameEn,
        dateOfBirth: date('2015-01-01'),
        gender,
        nationality: 'Nepali',
        motherTongue: 'Nepali',
        disabilityFlag: 'No known disability',
        admissionDate: date('2026-04-10'),
        admissionNumber: studentSystemId.replace('SCH', 'ADM'),
        mediumOfInstruct: 'English',
        classId: classroom.id,
        sectionId: section.id,
        section: sectionName,
        rollNumber,
        privacyConsentAt: new Date(),
        dataProcessingConsentedAt: new Date(),
        medicalConsentAt: new Date(),
        photoUsageConsentAt: studentSystemId === 'SCH-2026-0003' ? null : new Date(),
      },
      create: {
        tenantId,
        userId,
        studentSystemId,
        firstNameEn,
        lastNameEn,
        dateOfBirth: date('2015-01-01'),
        gender,
        nationality: 'Nepali',
        motherTongue: 'Nepali',
        disabilityFlag: 'No known disability',
        admissionDate: date('2026-04-10'),
        admissionNumber: studentSystemId.replace('SCH', 'ADM'),
        mediumOfInstruct: 'English',
        classId: classroom.id,
        sectionId: section.id,
        section: sectionName,
        rollNumber,
        privacyConsentAt: new Date(),
        dataProcessingConsentedAt: new Date(),
        medicalConsentAt: new Date(),
        photoUsageConsentAt: studentSystemId === 'SCH-2026-0003' ? null : new Date(),
      },
      select: { id: true, studentSystemId: true, classId: true, sectionId: true, firstNameEn: true, lastNameEn: true },
    });

    if (!student.sectionId) throw new Error(`Demo student ${studentSystemId} has no sectionId`);
    const safeStudent: DemoStudent = { ...student, sectionId: student.sectionId };

    const guardian = await prisma.guardian.upsert({
      where: { tenantId_primaryPhone: { tenantId, primaryPhone: phone } },
      update: {
        userId: linkParent && parentUser ? parentUser.id : undefined,
        fullName: guardianName,
        relation: 'Guardian',
        email: `${phone}@demo.schoolos.local`,
        homeAddress: 'Demo Address, Nepal',
        receivesAlerts: true,
        privacyConsentAt: new Date(),
      },
      create: {
        tenantId,
        userId: linkParent && parentUser ? parentUser.id : null,
        fullName: guardianName,
        relation: 'Guardian',
        primaryPhone: phone,
        email: `${phone}@demo.schoolos.local`,
        homeAddress: 'Demo Address, Nepal',
        receivesAlerts: true,
        privacyConsentAt: new Date(),
      },
      select: { id: true, userId: true, primaryPhone: true },
    });

    await prisma.studentGuardian.upsert({
      where: { studentId_guardianId: { studentId: safeStudent.id, guardianId: guardian.id } },
      update: { isPrimary: true, appLoginLinked: linkParent },
      create: { tenantId, studentId: safeStudent.id, guardianId: guardian.id, relation: 'Guardian', isPrimary: true, appLoginLinked: linkParent },
    });

    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        tenantId,
        academicYearId,
        studentId: safeStudent.id,
      },
    });

    if (existingEnrollment) {
      await prisma.enrollment.update({
        where: { id: existingEnrollment.id },
        data: {
          classId: classroom.id,
          sectionId: section.id,
          rollNumber,
          admissionNumber: studentSystemId.replace('SCH', 'ADM'),
          admissionDate: date('2026-04-10'),
          mediumOfInstruction: 'English',
        },
      });
    } else {
      await prisma.enrollment.create({
        data: {
          tenantId,
          academicYearId,
          studentId: safeStudent.id,
          classId: classroom.id,
          sectionId: section.id,
          rollNumber,
          admissionNumber: studentSystemId.replace('SCH', 'ADM'),
          admissionDate: date('2026-04-10'),
          mediumOfInstruction: 'English',
        },
      });
    }

    seeded.push({ student: safeStudent, guardian, className });
  }

  return seeded;
}

async function seedFees(
  prisma: PrismaClient,
  tenantId: string,
  academicYearId: string,
  users: UserMap,
  students: DemoStudentRow[],
) {
  const tuition = (await prisma.feeHead.findMany({ where: { tenantId } })).find((h) =>
    h.name.toLowerCase().includes('tuition'),
  );
  const accountant = users.get('accountant@schoolos.com');
  if (!tuition || !accountant) return;

  const cases = [
    ['SCH-2026-0004', 'INV-2026-0001', InvoiceStatus.PAID, 3500, PaymentMethod.CASH, 3500],
    ['SCH-2026-0005', 'INV-2026-0002', InvoiceStatus.PARTIAL, 3500, PaymentMethod.BANK, 1500],
    ['SCH-2026-0007', 'INV-2026-0003', InvoiceStatus.ISSUED, 5000, null, 0],
  ] as const;

  for (const [studentSystemId, invoiceNumber, status, amount, method, paid] of cases) {
    const row = students.find((s) => s.student.studentSystemId === studentSystemId);
    if (!row) continue;

    const invoice = await prisma.invoice.upsert({
      where: { tenantId_invoiceNumber: { tenantId, invoiceNumber } },
      update: {
        studentId: row.student.id,
        academicYearId,
        dueDate: date(status === InvoiceStatus.ISSUED ? '2026-04-15' : '2026-05-10'),
        status,
        subtotal: new Prisma.Decimal(amount),
        vatAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(amount),
        paidAt: status === InvoiceStatus.PAID ? new Date() : null,
      },
      create: {
        tenantId,
        studentId: row.student.id,
        academicYearId,
        invoiceNumber,
        dueDate: date(status === InvoiceStatus.ISSUED ? '2026-04-15' : '2026-05-10'),
        status,
        subtotal: new Prisma.Decimal(amount),
        vatAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(amount),
        paidAt: status === InvoiceStatus.PAID ? new Date() : null,
      },
    });

    await prisma.invoiceLine.deleteMany({ where: { tenantId, invoiceId: invoice.id } });
    await prisma.invoiceLine.create({
      data: { tenantId, invoiceId: invoice.id, feeHeadId: tuition.id, description: 'Demo tuition invoice line', quantity: 1, unitAmount: new Prisma.Decimal(amount), vatAmount: new Prisma.Decimal(0), totalAmount: new Prisma.Decimal(amount) },
    });

    if (method && paid > 0) {
      const referenceNumber = `PAY-${invoiceNumber}`;
      const existingPayment = await prisma.payment.findFirst({ where: { tenantId, referenceNumber } });
      const payment = existingPayment
        ? await prisma.payment.update({ where: { id: existingPayment.id }, data: { amount: new Prisma.Decimal(paid), method, invoiceId: invoice.id, studentId: row.student.id, collectedById: accountant.id, paidAt: new Date() } })
        : await prisma.payment.create({ data: { tenantId, studentId: row.student.id, invoiceId: invoice.id, collectedById: accountant.id, method, referenceNumber, amount: new Prisma.Decimal(paid), paidAt: new Date(), narration: 'Demo seeded payment' } });

      await prisma.receipt.upsert({
        where: { tenantId_receiptNumber: { tenantId, receiptNumber: `RCPT-${invoiceNumber}` } },
        update: { paymentId: payment.id, pdfUrl: `/demo/receipts/RCPT-${invoiceNumber}.pdf` },
        create: { tenantId, paymentId: payment.id, receiptNumber: `RCPT-${invoiceNumber}`, pdfUrl: `/demo/receipts/RCPT-${invoiceNumber}.pdf` },
      });
    }
  }
}

async function seedAttendance(
  prisma: PrismaClient,
  tenantId: string,
  academicYearId: string,
  users: UserMap,
  students: DemoStudentRow[],
) {
  const teacher = users.get('classteacher@schoolos.com');
  if (!teacher) return;

  for (const className of ['Class 1', 'Class 8']) {
    const group = students.filter((s) => s.className === className);
    if (!group.length) continue;

    const classId = group[0].student.classId;
    const sectionId = group[0].student.sectionId;

    for (const [index, attendanceDate] of lastSchoolDays(7).entries()) {
      const session = await prisma.attendanceSession.upsert({
        where: { tenantId_attendanceDate_classId_sectionId: { tenantId, attendanceDate, classId, sectionId } },
        update: { submittedById: teacher.id, submittedAt: new Date(), lockAt: new Date(attendanceDate.getTime() + 15 * 60 * 60 * 1000) },
        create: { tenantId, academicYearId, classId, sectionId, attendanceDate, submittedById: teacher.id, submittedAt: new Date(), lockAt: new Date(attendanceDate.getTime() + 15 * 60 * 60 * 1000) },
      });

      for (const [rowIndex, row] of group.entries()) {
        const absentCase = className === 'Class 8' && row.student.studentSystemId === 'SCH-2026-0007' && index <= 2;
        const status = absentCase ? AttendanceStatus.ABSENT : rowIndex === 1 && index === 1 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
        await prisma.attendanceRecord.upsert({
          where: { attendanceSessionId_studentId: { attendanceSessionId: session.id, studentId: row.student.id } },
          update: { status, remark: absentCase ? 'Demo consecutive absence case' : null },
          create: { tenantId, attendanceSessionId: session.id, studentId: row.student.id, status, remark: absentCase ? 'Demo consecutive absence case' : null },
        });
      }
    }
  }
}

async function seedNotices(
  prisma: PrismaClient,
  tenantId: string,
  users: UserMap,
): Promise<DemoNotice[]> {
  const principal = users.get('principal@schoolos.com');
  const notices = [
    ['Welcome to Academic Year', 'Welcome to the new academic year.', NoticePriority.NORMAL],
    ['Fee Payment Reminder', 'Please clear dues by the due date.', NoticePriority.URGENT],
    ['Parent-Teacher Meeting', 'Meeting is scheduled for Friday.', NoticePriority.NORMAL],
    ['Holiday Notice', 'School will remain closed on the public holiday.', NoticePriority.NORMAL],
    ['Emergency Notice', 'Early dismissal today due to weather.', NoticePriority.EMERGENCY],
  ] as const;
  const result: DemoNotice[] = [];

  for (const [title, body, priority] of notices) {
    const existing = await prisma.notice.findFirst({ where: { tenantId, title } });
    const notice = existing
      ? await prisma.notice.update({ where: { id: existing.id }, data: { body, priority, audienceType: AudienceType.ALL, createdById: principal?.id ?? null, publishedAt: new Date() } })
      : await prisma.notice.create({ data: { tenantId, title, body, priority, audienceType: AudienceType.ALL, createdById: principal?.id ?? null, publishedAt: new Date() } });
    result.push({ id: notice.id, title: notice.title, body: notice.body, audienceType: notice.audienceType });
  }

  return result;
}

async function seedActivityPosts(
  prisma: PrismaClient,
  tenantId: string,
  users: UserMap,
  students: DemoStudentRow[],
): Promise<DemoPost[]> {
  const teacher = users.get('classteacher@schoolos.com');
  if (!teacher) return [];

  const nursery = await findClass(prisma, tenantId, 'Nursery');
  const nurseryA = await findSection(prisma, tenantId, nursery.id, 'A');
  const tagged = students[0];
  const posts = [
    ['Montessori Activity', 'Children explored colors and shapes.', ActivityCategory.LEARNING, nursery.id, nurseryA.id, [] as string[]],
    ['Class Reading Circle', 'Students practiced group reading.', ActivityCategory.LEARNING, tagged.student.classId, tagged.student.sectionId, [] as string[]],
    ['Student Milestone', 'A tagged student completed a puzzle independently.', ActivityCategory.GENERAL, tagged.student.classId, tagged.student.sectionId, [tagged.student.id]],
  ] as const;
  const result: DemoPost[] = [];

  for (const [title, caption, category, classId, sectionId, studentIds] of posts) {
    const audienceType = studentIds.length ? AudienceType.ALL : AudienceType.SECTION;
    const existing = await prisma.activityPost.findFirst({ where: { tenantId, title } });
    const post = existing
      ? await prisma.activityPost.update({ where: { id: existing.id }, data: { caption, category, classId, sectionId, createdById: teacher.id, audienceType, publishedAt: new Date() } })
      : await prisma.activityPost.create({ data: { tenantId, title, caption, category, classId, sectionId, createdById: teacher.id, audienceType, publishedAt: new Date() } });

    await prisma.activityPostStudent.deleteMany({ where: { tenantId, activityPostId: post.id } });
    for (const studentId of studentIds) {
      await prisma.activityPostStudent.create({ data: { tenantId, activityPostId: post.id, studentId } });
    }

    result.push({ id: post.id, title: post.title, caption: post.caption, audienceType: post.audienceType });
  }

  return result;
}

async function seedDeliveries(
  prisma: PrismaClient,
  tenantId: string,
  notices: DemoNotice[],
  posts: DemoPost[],
  students: DemoStudentRow[],
) {
  const targets = students.slice(0, 3);
  const sources: Array<{ type: string; id: string; title: string; body: string; audienceType: AudienceType; noticeId: string | null; activityPostId: string | null }> = [
    ...notices.map((notice) => ({ type: 'notice', id: notice.id, title: notice.title, body: notice.body, audienceType: notice.audienceType, noticeId: notice.id, activityPostId: null })),
    ...posts.map((post) => ({ type: 'activity_post', id: post.id, title: post.title, body: post.caption, audienceType: post.audienceType, noticeId: null, activityPostId: post.id })),
  ];

  for (const source of sources) {
    await prisma.notificationDelivery.deleteMany({ where: { tenantId, sourceType: source.type, sourceId: source.id } });
    for (const [index, target] of targets.entries()) {
      await prisma.notificationDelivery.create({
        data: {
          tenantId,
          channel: NotificationChannel.PUSH,
          status: index === 2 ? NotificationStatus.FAILED : NotificationStatus.SENT,
          sourceType: source.type,
          sourceId: source.id,
          audienceType: source.audienceType,
          guardianId: target.guardian.id,
          studentId: target.student.id,
          noticeId: source.noticeId,
          activityPostId: source.activityPostId,
          destination: target.guardian.primaryPhone,
          title: source.title,
          body: source.body,
          errorMessage: index === 2 ? 'Demo retry case' : null,
          sentAt: index === 2 ? null : new Date(),
        },
      });
    }
  }
}

async function seedConsents(prisma: PrismaClient, tenantId: string, students: DemoStudentRow[]) {
  const guardians = Array.from(new Map(students.map((row) => [row.guardian.id, row.guardian])).values());

  for (const guardian of guardians) {
    for (const consentType of [ConsentType.PRIVACY, ConsentType.DATA_PROCESSING, ConsentType.MESSAGING, ConsentType.MEDICAL, ConsentType.PHOTO_USAGE]) {
      const granted = !(consentType === ConsentType.PHOTO_USAGE && guardian.primaryPhone === 'demo-phone-003');
      const existing = await prisma.guardianConsent.findFirst({ where: { tenantId, guardianId: guardian.id, consentType, version: 'demo-2026.1' } });
      if (existing) {
        await prisma.guardianConsent.update({ where: { id: existing.id }, data: { granted, revokedAt: granted ? null : new Date(), metadata: { source: 'seed' } } });
      } else {
        await prisma.guardianConsent.create({ data: { tenantId, guardianId: guardian.id, consentType, granted, version: 'demo-2026.1', revokedAt: granted ? null : new Date(), metadata: { source: 'seed' } } });
      }
    }
  }
}

async function findClass(prisma: PrismaClient, tenantId: string, name: string) {
  const classroom = await prisma.class.findUnique({ where: { tenantId_name: { tenantId, name } } });
  if (!classroom) throw new Error(`Class missing: ${name}`);
  return classroom;
}

async function findSection(prisma: PrismaClient, tenantId: string, classId: string, name: string) {
  const section = await prisma.section.findUnique({ where: { tenantId_classId_name: { tenantId, classId, name } } });
  if (!section) throw new Error(`Section missing: ${name}`);
  return section;
}

async function staffByEmail(prisma: PrismaClient, tenantId: string, users: UserMap, email: string) {
  const user = users.get(email);
  return user ? prisma.staff.findFirst({ where: { tenantId, userId: user.id } }) : null;
}

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function lastSchoolDays(count: number) {
  const dates: Date[] = [];
  const today = new Date();

  for (let offset = 1; dates.length < count; offset += 1) {
    const candidate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset),
    );
    if (candidate.getUTCDay() !== 6) dates.push(candidate);
  }

  return dates;
}

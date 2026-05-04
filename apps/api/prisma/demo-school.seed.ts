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

  console.log(`✅ Demo school data seeded: ${students.length} students with guardians, staff, fees, attendance, notices, activity, and consents.`);
}

async function getUsers(prisma: PrismaClient, tenantId: string) {
  const emails = ['principal@schoolos.com', 'accountant@schoolos.com', 'classteacher@schoolos.com', 'subjectteacher@schoolos.com', 'guardian@schoolos.com', 'student@schoolos.com'];
  const users = new Map<string, { id: string }>();
  for (const email of emails) {
    const user = await prisma.user.findUnique({ where: { tenantId_email: { tenantId, email } } });
    if (user) users.set(email, user);
  }
  return users;
}

async function seedStaff(prisma: PrismaClient, tenantId: string, users: Map<string, { id: string }>) {
  const rows = [
    ['principal@schoolos.com', 'EMP-DEMO-001', 'Anita', 'Sharma', Gender.FEMALE, '1982-01-10', 'Principal'],
    ['accountant@schoolos.com', 'EMP-DEMO-002', 'Suresh', 'Koirala', Gender.MALE, '1988-06-18', 'Accountant'],
    ['classteacher@schoolos.com', 'EMP-DEMO-003', 'Mina', 'Gautam', Gender.FEMALE, '1991-03-22', 'Class Teacher'],
    ['subjectteacher@schoolos.com', 'EMP-DEMO-004', 'Rajesh', 'Aryal', Gender.MALE, '1989-10-05', 'Subject Teacher'],
  ] as const;

  for (const [email, employeeId, firstName, lastName, gender, dob, role] of rows) {
    const user = users.get(email);
    if (!user) continue;
    await prisma.staff.upsert({
      where: { employeeId },
      update: { tenantId, userId: user.id, firstName, lastName, dateOfBirth: d(dob), gender, address: 'Demo Address, Nepal', teacherRegistryId: role.includes('Teacher') || role === 'Principal' ? `NTR-${employeeId}` : null, panNumber: `PAN-${employeeId}`, bankAccount: `BANK-${employeeId}`, bankName: 'Demo Bank', qualifications: `${role} qualification`, experience: `${role} demo profile`, joiningDate: d('2020-04-01'), contractType: ContractType.PERMANENT, privacyConsentAt: new Date() },
      create: { tenantId, userId: user.id, employeeId, firstName, lastName, dateOfBirth: d(dob), gender, address: 'Demo Address, Nepal', teacherRegistryId: role.includes('Teacher') || role === 'Principal' ? `NTR-${employeeId}` : null, panNumber: `PAN-${employeeId}`, bankAccount: `BANK-${employeeId}`, bankName: 'Demo Bank', qualifications: `${role} qualification`, experience: `${role} demo profile`, joiningDate: d('2020-04-01'), contractType: ContractType.PERMANENT, privacyConsentAt: new Date() },
    });
  }
}

async function seedSubjects(prisma: PrismaClient, tenantId: string, academicYearId: string, users: Map<string, { id: string }>) {
  const classTeacher = await staffByEmail(prisma, tenantId, users, 'classteacher@schoolos.com');
  const subjectTeacher = await staffByEmail(prisma, tenantId, users, 'subjectteacher@schoolos.com');
  const subjects = [['ENG', 'English', false], ['NEP', 'Nepali', false], ['MATH', 'Mathematics', false], ['SCI', 'Science', true], ['SOC', 'Social Studies', false], ['COMP', 'Computer Science', true]] as const;

  for (const className of ['Class 1', 'Class 8', 'Class 10']) {
    const cls = await clsByName(prisma, tenantId, className);
    const section = await sectionByName(prisma, tenantId, cls.id, 'A');
    for (const [code, name, hasPractical] of subjects) {
      const subject = await prisma.subject.upsert({
        where: { tenantId_classId_code: { tenantId, classId: cls.id, code } },
        update: { name, type: 'Core', hasPractical, theoryMarks: hasPractical ? 75 : 100, practicalMarks: hasPractical ? 25 : null, passMarks: 35 },
        create: { tenantId, classId: cls.id, code, name, type: 'Core', hasPractical, theoryMarks: hasPractical ? 75 : 100, practicalMarks: hasPractical ? 25 : null, passMarks: 35 },
      });
      const staffId = className === 'Class 1' ? classTeacher?.id : subjectTeacher?.id;
      if (!staffId || !['ENG', 'NEP', 'MATH', 'SCI'].includes(code)) continue;
      const existing = await prisma.subjectTeacherAssignment.findFirst({ where: { tenantId, academicYearId, classId: cls.id, sectionId: section.id, subjectId: subject.id, staffId } });
      if (!existing) await prisma.subjectTeacherAssignment.create({ data: { tenantId, academicYearId, classId: cls.id, sectionId: section.id, subjectId: subject.id, staffId } });
    }
  }
}

async function seedStudentsAndGuardians(prisma: PrismaClient, tenantId: string, academicYearId: string, users: Map<string, { id: string }>) {
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
  const out: Array<{ student: { id: string; studentSystemId: string; classId: string; sectionId: string | null; firstNameEn: string; lastNameEn: string }; guardian: { id: string; userId: string | null; primaryPhone: string }; className: string }> = [];

  for (const [systemId, firstName, lastName, gender, className, sectionName, roll, guardianName, phone, linkParent, linkStudent] of rows) {
    const cls = await clsByName(prisma, tenantId, className);
    const section = await sectionByName(prisma, tenantId, cls.id, sectionName);
    const student = await prisma.student.upsert({
      where: { tenantId_studentSystemId: { tenantId, studentSystemId: systemId } },
      update: { userId: linkStudent && studentUser ? studentUser.id : null, firstNameEn: firstName, lastNameEn: lastName, dateOfBirth: d('2015-01-01'), gender, nationality: 'Nepali', motherTongue: 'Nepali', disabilityFlag: 'No known disability', admissionDate: d('2026-04-10'), admissionNumber: systemId.replace('SCH', 'ADM'), mediumOfInstruct: 'English', classId: cls.id, sectionId: section.id, section: sectionName, rollNumber: roll, privacyConsentAt: new Date(), dataProcessingConsentedAt: new Date(), medicalConsentAt: new Date(), photoUsageConsentAt: systemId === 'SCH-2026-0003' ? null : new Date() },
      create: { tenantId, userId: linkStudent && studentUser ? studentUser.id : null, studentSystemId: systemId, firstNameEn: firstName, lastNameEn: lastName, dateOfBirth: d('2015-01-01'), gender, nationality: 'Nepali', motherTongue: 'Nepali', disabilityFlag: 'No known disability', admissionDate: d('2026-04-10'), admissionNumber: systemId.replace('SCH', 'ADM'), mediumOfInstruct: 'English', classId: cls.id, sectionId: section.id, section: sectionName, rollNumber: roll, privacyConsentAt: new Date(), dataProcessingConsentedAt: new Date(), medicalConsentAt: new Date(), photoUsageConsentAt: systemId === 'SCH-2026-0003' ? null : new Date() },
    });
    const guardian = await prisma.guardian.upsert({
      where: { tenantId_primaryPhone: { tenantId, primaryPhone: phone } },
      update: { userId: linkParent && parentUser ? parentUser.id : undefined, fullName: guardianName, relation: 'Guardian', email: `${phone}@demo.schoolos.local`, homeAddress: 'Demo Address, Nepal', receivesAlerts: true, privacyConsentAt: new Date() },
      create: { tenantId, userId: linkParent && parentUser ? parentUser.id : null, fullName: guardianName, relation: 'Guardian', primaryPhone: phone, email: `${phone}@demo.schoolos.local`, homeAddress: 'Demo Address, Nepal', receivesAlerts: true, privacyConsentAt: new Date() },
    });
    await prisma.studentGuardian.upsert({ where: { studentId_guardianId: { studentId: student.id, guardianId: guardian.id } }, update: { isPrimary: true, appLoginLinked: linkParent }, create: { tenantId, studentId: student.id, guardianId: guardian.id, relation: 'Guardian', isPrimary: true, appLoginLinked: linkParent } });
    await prisma.enrollment.upsert({ where: { tenantId_studentId_academicYearId: { tenantId, studentId: student.id, academicYearId } }, update: { classId: cls.id, sectionId: section.id, rollNumber: roll, admissionNumber: systemId.replace('SCH', 'ADM'), admissionDate: d('2026-04-10'), mediumOfInstruction: 'English' }, create: { tenantId, studentId: student.id, academicYearId, classId: cls.id, sectionId: section.id, rollNumber: roll, admissionNumber: systemId.replace('SCH', 'ADM'), admissionDate: d('2026-04-10'), mediumOfInstruction: 'English' } });
    out.push({ student, guardian, className });
  }
  return out;
}

async function seedFees(prisma: PrismaClient, tenantId: string, academicYearId: string, users: Map<string, { id: string }>, students: Awaited<ReturnType<typeof seedStudentsAndGuardians>>) {
  const tuition = (await prisma.feeHead.findMany({ where: { tenantId } })).find((h) => h.name.toLowerCase().includes('tuition'));
  const accountant = users.get('accountant@schoolos.com');
  if (!tuition || !accountant) return;
  const cases = [
    ['SCH-2026-0004', 'INV-2026-0001', InvoiceStatus.PAID, 3500, PaymentMethod.CASH, 3500],
    ['SCH-2026-0005', 'INV-2026-0002', InvoiceStatus.PARTIAL, 3500, PaymentMethod.BANK, 1500],
    ['SCH-2026-0007', 'INV-2026-0003', InvoiceStatus.ISSUED, 5000, null, 0],
  ] as const;
  for (const [systemId, invoiceNumber, status, amount, method, paid] of cases) {
    const row = students.find((s) => s.student.studentSystemId === systemId);
    if (!row) continue;
    const invoice = await prisma.invoice.upsert({
      where: { tenantId_invoiceNumber: { tenantId, invoiceNumber } },
      update: { studentId: row.student.id, academicYearId, dueDate: d(status === InvoiceStatus.ISSUED ? '2026-04-15' : '2026-05-10'), status, subtotal: new Prisma.Decimal(amount), vatAmount: new Prisma.Decimal(0), totalAmount: new Prisma.Decimal(amount), paidAt: status === InvoiceStatus.PAID ? new Date() : null },
      create: { tenantId, studentId: row.student.id, academicYearId, invoiceNumber, dueDate: d(status === InvoiceStatus.ISSUED ? '2026-04-15' : '2026-05-10'), status, subtotal: new Prisma.Decimal(amount), vatAmount: new Prisma.Decimal(0), totalAmount: new Prisma.Decimal(amount), paidAt: status === InvoiceStatus.PAID ? new Date() : null },
    });
    await prisma.invoiceLine.deleteMany({ where: { tenantId, invoiceId: invoice.id } });
    await prisma.invoiceLine.create({ data: { tenantId, invoiceId: invoice.id, feeHeadId: tuition.id, description: 'Demo tuition invoice line', quantity: 1, unitAmount: new Prisma.Decimal(amount), vatAmount: new Prisma.Decimal(0), totalAmount: new Prisma.Decimal(amount) } });
    if (method && paid > 0) {
      const referenceNumber = `PAY-${invoiceNumber}`;
      const existingPayment = await prisma.payment.findFirst({ where: { tenantId, referenceNumber } });
      const payment = existingPayment ? await prisma.payment.update({ where: { id: existingPayment.id }, data: { amount: new Prisma.Decimal(paid), method, invoiceId: invoice.id, studentId: row.student.id, collectedById: accountant.id, paidAt: new Date() } }) : await prisma.payment.create({ data: { tenantId, studentId: row.student.id, invoiceId: invoice.id, collectedById: accountant.id, method, referenceNumber, amount: new Prisma.Decimal(paid), paidAt: new Date(), narration: 'Demo seeded payment' } });
      await prisma.receipt.upsert({ where: { tenantId_receiptNumber: { tenantId, receiptNumber: `RCPT-${invoiceNumber}` } }, update: { paymentId: payment.id, pdfUrl: `/demo/receipts/RCPT-${invoiceNumber}.pdf` }, create: { tenantId, paymentId: payment.id, receiptNumber: `RCPT-${invoiceNumber}`, pdfUrl: `/demo/receipts/RCPT-${invoiceNumber}.pdf` } });
    }
  }
}

async function seedAttendance(prisma: PrismaClient, tenantId: string, academicYearId: string, users: Map<string, { id: string }>, students: Awaited<ReturnType<typeof seedStudentsAndGuardians>>) {
  const teacher = users.get('classteacher@schoolos.com');
  if (!teacher) return;
  for (const className of ['Class 1', 'Class 8']) {
    const group = students.filter((s) => s.className === className);
    if (!group.length) continue;
    for (const [i, attendanceDate] of lastSchoolDays(7).entries()) {
      const session = await prisma.attendanceSession.upsert({ where: { tenantId_attendanceDate_classId_sectionId: { tenantId, attendanceDate, classId: group[0].student.classId, sectionId: group[0].student.sectionId } }, update: { submittedById: teacher.id, submittedAt: new Date(), lockAt: new Date(attendanceDate.getTime() + 15 * 60 * 60 * 1000) }, create: { tenantId, academicYearId, classId: group[0].student.classId, sectionId: group[0].student.sectionId, attendanceDate, submittedById: teacher.id, submittedAt: new Date(), lockAt: new Date(attendanceDate.getTime() + 15 * 60 * 60 * 1000) } });
      for (const [idx, row] of group.entries()) {
        const absentCase = className === 'Class 8' && row.student.studentSystemId === 'SCH-2026-0007' && i <= 2;
        const status = absentCase ? AttendanceStatus.ABSENT : idx === 1 && i === 1 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
        await prisma.attendanceRecord.upsert({ where: { attendanceSessionId_studentId: { attendanceSessionId: session.id, studentId: row.student.id } }, update: { status, remark: absentCase ? 'Demo consecutive absence case' : null }, create: { tenantId, attendanceSessionId: session.id, studentId: row.student.id, status, remark: absentCase ? 'Demo consecutive absence case' : null } });
      }
    }
  }
}

async function seedNotices(prisma: PrismaClient, tenantId: string, users: Map<string, { id: string }>) {
  const principal = users.get('principal@schoolos.com');
  const notices = [
    ['Welcome to Academic Year', 'Welcome to the new academic year.', NoticePriority.NORMAL],
    ['Fee Payment Reminder', 'Please clear dues by the due date.', NoticePriority.URGENT],
    ['Parent-Teacher Meeting', 'Meeting is scheduled for Friday.', NoticePriority.NORMAL],
    ['Holiday Notice', 'School will remain closed on the public holiday.', NoticePriority.NORMAL],
    ['Emergency Notice', 'Early dismissal today due to weather.', NoticePriority.EMERGENCY],
  ] as const;
  const out = [];
  for (const [title, body, priority] of notices) {
    const existing = await prisma.notice.findFirst({ where: { tenantId, title } });
    out.push(existing ? await prisma.notice.update({ where: { id: existing.id }, data: { body, priority, audienceType: AudienceType.ALL, createdById: principal?.id ?? null, publishedAt: new Date() } }) : await prisma.notice.create({ data: { tenantId, title, body, priority, audienceType: AudienceType.ALL, createdById: principal?.id ?? null, publishedAt: new Date() } }));
  }
  return out;
}

async function seedActivityPosts(prisma: PrismaClient, tenantId: string, users: Map<string, { id: string }>, students: Awaited<ReturnType<typeof seedStudentsAndGuardians>>) {
  const teacher = users.get('classteacher@schoolos.com');
  if (!teacher) return [];
  const nursery = await clsByName(prisma, tenantId, 'Nursery');
  const section = await sectionByName(prisma, tenantId, nursery.id, 'A');
  const tagged = students[0];
  const posts = [
    ['Montessori Activity', 'Children explored colors and shapes.', ActivityCategory.LEARNING, nursery.id, section.id, [] as string[]],
    ['Class Reading Circle', 'Students practiced group reading.', ActivityCategory.LEARNING, tagged.student.classId, tagged.student.sectionId, [] as string[]],
    ['Student Milestone', 'A tagged student completed a puzzle independently.', ActivityCategory.GENERAL, tagged.student.classId, tagged.student.sectionId, [tagged.student.id]],
  ] as const;
  const out = [];
  for (const [title, caption, category, classId, sectionId, studentIds] of posts) {
    const existing = await prisma.activityPost.findFirst({ where: { tenantId, title } });
    const post = existing ? await prisma.activityPost.update({ where: { id: existing.id }, data: { caption, category, classId, sectionId, createdById: teacher.id, publishedAt: new Date() } }) : await prisma.activityPost.create({ data: { tenantId, title, caption, category, classId, sectionId, createdById: teacher.id, audienceType: studentIds.length ? AudienceType.ALL : AudienceType.SECTION, publishedAt: new Date() } });
    await prisma.activityPostStudent.deleteMany({ where: { tenantId, activityPostId: post.id } });
    for (const studentId of studentIds) await prisma.activityPostStudent.create({ data: { tenantId, activityPostId: post.id, studentId } });
    out.push(post);
  }
  return out;
}

async function seedDeliveries(prisma: PrismaClient, tenantId: string, notices: Awaited<ReturnType<typeof seedNotices>>, posts: Awaited<ReturnType<typeof seedActivityPosts>>, students: Awaited<ReturnType<typeof seedStudentsAndGuardians>>) {
  const targets = students.slice(0, 3);
  for (const source of [...notices.map((n) => ({ type: 'notice', id: n.id, title: n.title, body: n.body, noticeId: n.id, activityPostId: null })), ...posts.map((p) => ({ type: 'activity_post', id: p.id, title: p.title, body: p.caption, noticeId: null, activityPostId: p.id }))]) {
    await prisma.notificationDelivery.deleteMany({ where: { tenantId, sourceType: source.type, sourceId: source.id } });
    for (const [idx, target] of targets.entries()) await prisma.notificationDelivery.create({ data: { tenantId, channel: NotificationChannel.PUSH, status: idx === 2 ? NotificationStatus.FAILED : NotificationStatus.SENT, sourceType: source.type, sourceId: source.id, audienceType: AudienceType.ALL, guardianId: target.guardian.id, studentId: target.student.id, noticeId: source.noticeId, activityPostId: source.activityPostId, destination: target.guardian.primaryPhone, title: source.title, body: source.body, errorMessage: idx === 2 ? 'Demo retry case' : null, sentAt: idx === 2 ? null : new Date() } });
  }
}

async function seedConsents(prisma: PrismaClient, tenantId: string, students: Awaited<ReturnType<typeof seedStudentsAndGuardians>>) {
  const guardians = Array.from(new Map(students.map((s) => [s.guardian.id, s.guardian])).values());
  for (const guardian of guardians) {
    for (const type of [ConsentType.PRIVACY, ConsentType.DATA_PROCESSING, ConsentType.MESSAGING, ConsentType.MEDICAL, ConsentType.PHOTO_USAGE]) {
      const granted = !(type === ConsentType.PHOTO_USAGE && guardian.primaryPhone === 'demo-phone-003');
      const existing = await prisma.guardianConsent.findFirst({ where: { tenantId, guardianId: guardian.id, consentType: type, version: 'demo-2026.1' } });
      if (existing) await prisma.guardianConsent.update({ where: { id: existing.id }, data: { granted, revokedAt: granted ? null : new Date(), metadata: { source: 'seed' } } });
      else await prisma.guardianConsent.create({ data: { tenantId, guardianId: guardian.id, consentType: type, granted, version: 'demo-2026.1', revokedAt: granted ? null : new Date(), metadata: { source: 'seed' } } });
    }
  }
}

async function clsByName(prisma: PrismaClient, tenantId: string, name: string) { const cls = await prisma.class.findUnique({ where: { tenantId_name: { tenantId, name } } }); if (!cls) throw new Error(`Class missing: ${name}`); return cls; }
async function sectionByName(prisma: PrismaClient, tenantId: string, classId: string, name: string) { const section = await prisma.section.findUnique({ where: { tenantId_classId_name: { tenantId, classId, name } } }); if (!section) throw new Error(`Section missing: ${name}`); return section; }
async function staffByEmail(prisma: PrismaClient, tenantId: string, users: Map<string, { id: string }>, email: string) { const user = users.get(email); return user ? prisma.staff.findFirst({ where: { tenantId, userId: user.id } }) : null; }
function d(value: string) { return new Date(`${value}T00:00:00.000Z`); }
function lastSchoolDays(count: number) { const dates: Date[] = []; const today = new Date(); for (let offset = 1; dates.length < count; offset++) { const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset)); if (date.getUTCDay() !== 6) dates.push(date); } return dates; }

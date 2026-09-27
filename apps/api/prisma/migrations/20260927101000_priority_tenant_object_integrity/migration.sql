-- Tenant-owned priority relations are checked at the database boundary, including
-- nested Prisma writes and raw SQL. Existing corruption stops rollout; no history is rewritten.
CREATE FUNCTION schoolos_check_tenant_reference() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reference_id text; reference_tenant text;
BEGIN
  reference_id := to_jsonb(NEW)->>TG_ARGV[0];
  IF reference_id IS NULL THEN RETURN NEW; END IF;
  EXECUTE format('SELECT "tenantId" FROM %I WHERE "id"=$1 FOR KEY SHARE', TG_ARGV[1])
    INTO reference_tenant USING reference_id;
  IF reference_tenant IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'Tenant-owned reference is not available' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION schoolos_prohibit_tenant_move() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
    RAISE EXCEPTION 'Tenant ownership is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE edge record; mismatches bigint; source_table text;
BEGIN
  FOR edge IN
    SELECT src.relname AS source, dst.relname AS target, a.attname AS column_name
    FROM pg_constraint c
    JOIN pg_class src ON src.oid=c.conrelid
    JOIN pg_namespace ns ON ns.oid=src.relnamespace AND ns.nspname='public'
    JOIN pg_class dst ON dst.oid=c.confrelid
    JOIN pg_attribute a ON a.attrelid=src.oid AND a.attnum=c.conkey[1]
    JOIN pg_attribute b ON b.attrelid=dst.oid AND b.attnum=c.confkey[1] AND b.attname='id'
    WHERE c.contype='f' AND cardinality(c.conkey)=1
      AND src.relname=ANY(ARRAY['Student','Guardian','GuardianIdentityVerification','StudentGuardian','Enrollment','StudentDocument','StudentMergeHistory','StudentDuplicateReview','StudentIdentity','StudentQrCredential','AdmissionImportBatch','AdmissionImportRow','AdmissionApplication','AdmissionAssessmentSession','StudentDocumentExpiryTemplate','StudentDocumentHistory','GeneratedStudentDocument','StudentLifecycleTransition','SiblingGroup','SiblingGroupMember','AcademicYear','Class','Stream','Section','Subject','SubjectTeacherAssignment','SubjectWeeklyRequirement','SyllabusTopic','AttendanceSession','AttendanceRecord','AttendanceCorrectionRequest','StaffAttendance','SchoolCalendarDay','StaffLeaveBalance','StaffLeaveRequest','StudentLeaveRequest','AttendanceConflict','AttendanceSyncSubmission','AttendanceDraft','ExamTerm','AssessmentComponent','MarkEntry','CasRecord','ReportCard','ReportCardSubjectResult','ReportCardHistory','ReportCardCorrectionRequest','ExamTimetableSlot','AssessmentRetake','MarkLockRequest','PromotionRecord','FeeHead','FeePlan','FeePlanItem','StudentFeeAssignment','Invoice','InvoiceLine','Payment','PaymentAllocation','OnlinePaymentIntent','PaymentRefund','CashierClose','CashDeposit','Receipt','ReceiptSequence','ReceiptReprintHistory','FeeDueSchedule','FeeBillingRun','DiscountRule','FeeWaiver','FinanceApprovalRequest','FinanceApprovalRequestHistory','Staff','StaffQualification','StaffDocument','StaffLifecycleEvent','StaffExperienceRecord','StaffContract','SalaryStructure','SalaryComponent','PayrollRun','PayrollException','PayrollLine','Payslip','ChartAccount','AccountingSourceMapping','JournalEntry','JournalEntrySequence','JournalLine','FiscalYear','FiscalPeriod','AccountingPeriod','AccountingPostingBatch','AccountingPostingItem','FinanceVendor','FinanceExpense','FinancePayable','FinancePayableSettlement','BankReconciliationSession','BankReconciliationMatch','BankReconciliationHistory','ReportSavedView','PayrollAccountingSnapshot','AccountingReportAccountMapping','BankStatement','BankStatementImportBatch','BankStatementImportJob','FiscalBudget','FiscalBudgetLine','Notice','NoticeAcknowledgement','Event','NotificationDelivery','NotificationEvent','NotificationPreference','NotificationReadReceipt','MobilePushToken','NoticeReadReceipt','CommunicationTemplate','GuardianConsent','ConsentTemplate','CommunicationPreference','FileAsset','DataExportJob','GeneratedDocument','RoleScopeGrant'])
      AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid=dst.oid AND x.attname='tenantId' AND NOT x.attisdropped)
      AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid=src.oid AND x.attname='tenantId' AND NOT x.attisdropped)
  LOOP
    EXECUTE format('SELECT count(*) FROM %I s JOIN %I d ON d."id"=s.%I WHERE s."tenantId"<>d."tenantId"', edge.source, edge.target, edge.column_name) INTO mismatches;
    IF mismatches>0 THEN
      RAISE EXCEPTION 'Tenant integrity preflight failed for %.% (% rows); repair under reviewed recovery before rollout', edge.source, edge.column_name, mismatches;
    END IF;
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF %I, "tenantId" ON %I FOR EACH ROW EXECUTE FUNCTION schoolos_check_tenant_reference(%L,%L)',
      'tenant_ref_'||edge.column_name, edge.column_name, edge.source, edge.column_name, edge.target);
  END LOOP;
  -- Referenced tenants must remain stable even when a parent is outside the priority list.
  FOR source_table IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public'
    WHERE c.relkind='r' AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='tenantId' AND NOT a.attisdropped)
  LOOP
    EXECUTE format('CREATE TRIGGER "tenant_ownership_immutable" BEFORE UPDATE OF "tenantId" ON %I FOR EACH ROW EXECUTE FUNCTION schoolos_prohibit_tenant_move()', source_table);
  END LOOP;
END $$;

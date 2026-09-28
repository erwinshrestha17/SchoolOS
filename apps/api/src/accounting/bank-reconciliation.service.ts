import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import type { AuthContext } from '../auth/auth.types';
import { withSchoolAuthorizationTransaction } from '../auth/school-authorization-transaction';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingPostingService } from './accounting-posting.service';
import { requireDomainPermission } from '../authorization/policies/domain-permission';
import { isFinancialTransactionConflict } from '../authorization/policies/financial-transaction-conflict';
import {
  reconciliationAllowedActions,
  reconciliationPermission,
  requireReconciliationDuty,
  type ReconciliationDuty,
} from '../authorization/policies/reconciliation.policy';
import type {
  AmendReconciliationDto,
  PrepareReconciliationDto,
} from './dto/reconciliation-session.dto';

const sessionInclude = {
  matches: { take: 5001 },
  history: { take: 200, orderBy: { createdAt: 'desc' as const } },
};
type Session = Prisma.BankReconciliationSessionGetPayload<{
  include: typeof sessionInclude;
}>;
const READ = 'accounting:reconciliation:read';
const MANAGE = 'accounting:reconciliation:manage';
const MAX_SOURCE_ROWS = 5000;
const DAY = 86_400_000;

@Injectable()
export class BankReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly posting: AccountingPostingService,
  ) {}

  private async transaction<T>(
    actor: AuthContext,
    permission: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    requireDomainPermission(actor, permission);
    try {
      return await withSchoolAuthorizationTransaction(
        this.prisma,
        actor,
        permission,
        [],
        work,
        false,
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        isFinancialTransactionConflict(error) ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002')
      )
        throw new ConflictException(
          'Reconciliation changed concurrently. Reload before retrying.',
        );
      throw error;
    }
  }
  private async load(
    tx: Prisma.TransactionClient,
    id: string,
    actor: AuthContext,
  ): Promise<Session> {
    const session = await tx.bankReconciliationSession.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: sessionInclude,
    });
    if (!session)
      throw new NotFoundException('Reconciliation session not found');
    if (session.matches.length > MAX_SOURCE_ROWS)
      throw new ConflictException(
        'Reconciliation matching history exceeds the supported limit',
      );
    return session;
  }
  private async period(
    tx: Prisma.TransactionClient,
    session: {
      fiscalPeriodId: string | null;
      statementFrom: Date;
      statementTo: Date;
    },
    actor: AuthContext,
  ) {
    if (!session.fiscalPeriodId)
      throw new ConflictException(
        'A fiscal period is required for reconciliation',
      );
    const period = await this.posting.lockPostingPeriod(
      tx,
      actor.tenantId,
      session.statementFrom,
    );
    if (
      period.id !== session.fiscalPeriodId ||
      session.statementTo > period.endDate
    )
      throw new ConflictException(
        'Reconciliation dates must belong to one open fiscal period',
      );
    return period;
  }
  private async history(
    tx: Prisma.TransactionClient,
    session: Session,
    actor: AuthContext,
    action: string,
    reason: string | null,
    after: Prisma.InputJsonObject,
  ) {
    await tx.bankReconciliationHistory.create({
      data: {
        tenantId: actor.tenantId,
        sessionId: session.id,
        actorUserId: actor.userId,
        action,
        reason,
        beforeState: { status: session.status, revision: session.revision },
        afterState: after,
      },
    });
    await this.audit.record(
      {
        tenantId: actor.tenantId,
        userId: actor.userId,
        resource: 'bank_reconciliation_session',
        resourceId: session.id,
        action,
        before: { status: session.status, revision: session.revision },
        after: { ...after, reason },
      },
      tx,
    );
  }
  private async claim(
    tx: Prisma.TransactionClient,
    session: Session,
    actor: AuthContext,
    data: Prisma.BankReconciliationSessionUpdateManyMutationInput,
  ) {
    const result = await tx.bankReconciliationSession.updateMany({
      where: {
        id: session.id,
        tenantId: actor.tenantId,
        revision: session.revision,
        status: session.status,
      },
      data: { ...data, revision: { increment: 1 } },
    });
    if (result.count !== 1)
      throw new ConflictException(
        'Reconciliation changed concurrently. Reload before retrying.',
      );
  }

  async prepare(dto: PrepareReconciliationDto, actor: AuthContext) {
    const from = dateOnly(dto.statementFrom);
    const to = dateOnly(dto.statementTo);
    if (from > to)
      throw new BadRequestException('Statement start must not follow its end');
    const opening = money(dto.openingBankBalance);
    const closing = money(dto.closingBankBalance);
    const reference = dto.statementReference?.trim();
    if (!reference || reference.length < 3 || reference.length > 240)
      throw new BadRequestException('A bank statement reference is required');
    return this.transaction(actor, MANAGE, async (tx) => {
      const account = await tx.chartAccount.findFirst({
        where: {
          id: dto.accountId,
          tenantId: actor.tenantId,
          isActive: true,
          type: 'ASSET',
        },
      });
      if (!account)
        throw new NotFoundException('Active bank account not found');
      await this.period(
        tx,
        {
          fiscalPeriodId: dto.fiscalPeriodId,
          statementFrom: from,
          statementTo: to,
        },
        actor,
      );
      const overlap = await tx.bankReconciliationSession.findFirst({
        where: {
          tenantId: actor.tenantId,
          accountId: account.id,
          cancelledAt: null,
          OR: [
            { finalizedAt: null },
            { statementFrom: { lte: to }, statementTo: { gte: from } },
          ],
        },
        select: { id: true },
      });
      if (overlap)
        throw new ConflictException(
          'An unfinished or overlapping reconciliation session already exists',
        );
      const session = await tx.bankReconciliationSession.create({
        data: {
          tenantId: actor.tenantId,
          accountId: account.id,
          fiscalPeriodId: dto.fiscalPeriodId,
          statementFrom: from,
          statementTo: to,
          openingBookBalance: 0,
          closingBookBalance: 0,
          openingBankBalance: opening,
          closingBankBalance: closing,
          createdById: actor.userId,
          sourceSnapshot: { statementReference: reference },
        },
        include: sessionInclude,
      });
      const source = await this.source(tx, session, actor);
      await this.claim(tx, session, actor, {
        openingBookBalance: source.openingBookBalance,
        closingBookBalance: source.closingBookBalance,
        difference: source.difference,
        sourceSnapshot: source.snapshot,
      });
      await this.history(tx, session, actor, 'prepare', null, {
        statementReference: reference,
        status: 'OPEN',
        openingBankBalance: opening.toFixed(2),
        closingBankBalance: closing.toFixed(2),
      });
      return this.project(await this.load(tx, session.id, actor), actor);
    });
  }
  /** Close readiness must never treat provisional matches or stale final evidence as reconciled. */
  async unresolvedForPeriodClose(
    fiscalPeriodId: string,
    actor: AuthContext,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const sessions = await tx.bankReconciliationSession.findMany({
      where: { tenantId: actor.tenantId, fiscalPeriodId, cancelledAt: null },
      include: sessionInclude,
      take: 101,
    });
    if (sessions.length > 100) return sessions.length;
    let unresolved = 0;
    for (const session of sessions) {
      if (
        session.status !== 'FINALIZED' ||
        !session.finalizedById ||
        !session.reviewedById ||
        !session.sourceFingerprint ||
        session.matches.length > MAX_SOURCE_ROWS
      ) {
        unresolved += 1;
        continue;
      }
      try {
        const fresh = await this.source(tx, session, actor);
        if (
          fresh.issues.length ||
          fresh.fingerprint !== session.sourceFingerprint
        )
          unresolved += 1;
      } catch (error) {
        if (
          error instanceof ConflictException ||
          error instanceof BadRequestException
        )
          unresolved += 1;
        else throw error;
      }
    }
    return unresolved;
  }

  async list(accountId: string, actor: AuthContext) {
    return this.transaction(actor, READ, async (tx) => {
      const sessions = await tx.bankReconciliationSession.findMany({
        where: { tenantId: actor.tenantId, accountId },
        include: sessionInclude,
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return sessions.map((session) => this.project(session, actor));
    });
  }
  async get(id: string, actor: AuthContext) {
    return this.transaction(actor, READ, async (tx) =>
      this.project(await this.load(tx, id, actor), actor),
    );
  }
  async match(
    id: string,
    statementId: string,
    journalLineId: string,
    actor: AuthContext,
  ) {
    return this.transaction(actor, MANAGE, async (tx) => {
      const session = await this.load(tx, id, actor);
      requireReconciliationDuty(actor, session, 'MANAGE');
      await this.period(tx, session, actor);
      const statement = await tx.bankStatement.findFirst({
        where: {
          id: statementId,
          tenantId: actor.tenantId,
          accountId: session.accountId,
          statementDate: {
            gte: session.statementFrom,
            lt: new Date(session.statementTo.getTime() + DAY),
          },
        },
      });
      if (!statement)
        throw new NotFoundException(
          'Statement line in this reconciliation was not found',
        );
      if (session.matches.length >= MAX_SOURCE_ROWS)
        throw new ConflictException(
          'Start a smaller reconciliation session after returning this one',
        );
      if (statement.isReconciled)
        throw new ConflictException('Statement line is already reconciled');
      const line = await tx.journalLine.findFirst({
        where: {
          id: journalLineId,
          tenantId: actor.tenantId,
          chartAccountId: session.accountId,
          journalEntry: {
            tenantId: actor.tenantId,
            status: 'POSTED',
            fiscalPeriodId: session.fiscalPeriodId,
            entryDate: {
              gte: session.statementFrom,
              lt: new Date(session.statementTo.getTime() + DAY),
            },
          },
        },
      });
      if (!line)
        throw new NotFoundException(
          'Posted journal line in this reconciliation was not found',
        );
      const bankAmount = statement.debitAmount.minus(statement.creditAmount);
      const bookAmount = line.debit.minus(line.credit);
      if (!bankAmount.eq(bookAmount))
        throw new ConflictException(
          'Statement and journal amounts must match before reconciliation',
        );
      const result = await tx.bankStatement.updateMany({
        where: {
          id: statement.id,
          tenantId: actor.tenantId,
          isReconciled: false,
        },
        data: {
          isReconciled: true,
          reconciledAt: new Date(),
          reconciledById: actor.userId,
          journalLineId: line.id,
        },
      });
      if (result.count !== 1)
        throw new ConflictException(
          'Statement line changed while reconciliation was being confirmed',
        );
      await tx.bankReconciliationMatch.create({
        data: {
          tenantId: actor.tenantId,
          sessionId: session.id,
          bankStatementId: statement.id,
          journalLineId: line.id,
          matchType: 'EXACT',
          bankAmount,
          bookAmount,
          matchedById: actor.userId,
        },
      });
      const source = await this.source(
        tx,
        await this.load(tx, id, actor),
        actor,
      );
      await this.claim(tx, session, actor, {
        sourceSnapshot: source.snapshot,
        openingBookBalance: source.openingBookBalance,
        closingBookBalance: source.closingBookBalance,
        difference: source.difference,
      });
      await this.history(tx, session, actor, 'match', null, {
        statementId: statement.id,
        journalLineId: line.id,
      });
      return this.project(await this.load(tx, id, actor), actor);
    });
  }
  async unmatch(
    id: string,
    statementId: string,
    reason: string,
    actor: AuthContext,
  ) {
    const note = requiredReason(reason);
    return this.transaction(actor, MANAGE, async (tx) => {
      const session = await this.load(tx, id, actor);
      requireReconciliationDuty(actor, session, 'MANAGE');
      await this.period(tx, session, actor);
      const match = session.matches.find(
        (row) =>
          row.bankStatementId === statementId && row.status === 'MATCHED',
      );
      if (!match)
        throw new NotFoundException(
          'Active match in this reconciliation was not found',
        );
      const statement = await tx.bankStatement.updateMany({
        where: {
          id: statementId,
          tenantId: actor.tenantId,
          isReconciled: true,
          journalLineId: match.journalLineId,
        },
        data: {
          isReconciled: false,
          reconciledAt: null,
          reconciledById: null,
          journalLineId: null,
        },
      });
      if (statement.count !== 1)
        throw new ConflictException(
          'Reconciliation match no longer agrees with the statement',
        );
      const result = await tx.bankReconciliationMatch.updateMany({
        where: {
          id: match.id,
          tenantId: actor.tenantId,
          sessionId: session.id,
          status: 'MATCHED',
        },
        data: {
          status: 'UNMATCHED',
          unmatchedAt: new Date(),
          unmatchedById: actor.userId,
          unmatchReason: note,
        },
      });
      if (result.count !== 1)
        throw new ConflictException(
          'Reconciliation match changed concurrently',
        );
      const source = await this.source(
        tx,
        await this.load(tx, id, actor),
        actor,
      );
      await this.claim(tx, session, actor, {
        sourceSnapshot: source.snapshot,
        openingBookBalance: source.openingBookBalance,
        closingBookBalance: source.closingBookBalance,
        difference: source.difference,
      });
      await this.history(tx, session, actor, 'unmatch', note, { statementId });
      return this.project(await this.load(tx, id, actor), actor);
    });
  }
  async amend(id: string, dto: AmendReconciliationDto, actor: AuthContext) {
    const note = requiredReason(dto.reason);
    const opening = money(dto.openingBankBalance);
    const closing = money(dto.closingBankBalance);
    const reference = dto.statementReference?.trim();
    if (!reference || reference.length < 3 || reference.length > 240)
      throw new BadRequestException('A bank statement reference is required');
    return this.transaction(actor, MANAGE, async (tx) => {
      const session = await this.load(tx, id, actor);
      requireReconciliationDuty(actor, session, 'MANAGE');
      await this.period(tx, session, actor);
      const changed = {
        ...session,
        openingBankBalance: opening,
        closingBankBalance: closing,
        sourceSnapshot: { statementReference: reference },
      };
      const source = await this.source(tx, changed, actor);
      await this.claim(tx, session, actor, {
        openingBankBalance: opening,
        closingBankBalance: closing,
        sourceSnapshot: source.snapshot,
        openingBookBalance: source.openingBookBalance,
        closingBookBalance: source.closingBookBalance,
        difference: source.difference,
      });
      await this.history(tx, session, actor, 'amend_bank_balances', note, {
        openingBankBalance: opening.toFixed(2),
        closingBankBalance: closing.toFixed(2),
        statementReference: reference,
      });
      return this.project(await this.load(tx, id, actor), actor);
    });
  }
  async cancel(id: string, reason: string, actor: AuthContext) {
    const note = requiredReason(reason);
    return this.transaction(actor, MANAGE, async (tx) => {
      const session = await this.load(tx, id, actor);
      requireReconciliationDuty(actor, session, 'CANCEL');
      await this.period(tx, session, actor);
      for (const match of session.matches.filter(
        (row) => row.status === 'MATCHED',
      )) {
        const result = await tx.bankStatement.updateMany({
          where: {
            id: match.bankStatementId,
            tenantId: actor.tenantId,
            isReconciled: true,
            journalLineId: match.journalLineId,
          },
          data: {
            isReconciled: false,
            reconciledAt: null,
            reconciledById: null,
            journalLineId: null,
          },
        });
        if (result.count !== 1)
          throw new ConflictException(
            'Reconciliation match no longer agrees with the statement',
          );
      }
      await tx.bankReconciliationMatch.updateMany({
        where: {
          tenantId: actor.tenantId,
          sessionId: session.id,
          status: 'MATCHED',
        },
        data: {
          status: 'UNMATCHED',
          unmatchedAt: new Date(),
          unmatchedById: actor.userId,
          unmatchReason: note,
        },
      });
      await this.claim(tx, session, actor, {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledById: actor.userId,
      });
      await this.history(tx, session, actor, 'cancel', note, {
        status: 'CANCELLED',
      });
      return this.project(await this.load(tx, id, actor), actor);
    });
  }
  async transition(
    id: string,
    duty: Exclude<ReconciliationDuty, 'MANAGE' | 'CANCEL'>,
    reason: string | undefined,
    actor: AuthContext,
  ) {
    const note = duty === 'SUBMIT' ? null : requiredReason(reason);
    return this.transaction(
      actor,
      reconciliationPermission(duty),
      async (tx) => {
        const session = await this.load(tx, id, actor);
        requireReconciliationDuty(actor, session, duty);
        await this.period(tx, session, actor);
        let data: Prisma.BankReconciliationSessionUpdateManyMutationInput;
        if (duty === 'RETURN') {
          data = {
            status: 'OPEN',
            submittedAt: null,
            submittedById: null,
            reviewedAt: null,
            reviewedById: null,
            reviewReason: null,
            sourceFingerprint: null,
          };
        } else {
          const source = await this.source(tx, session, actor);
          if (
            duty !== 'SUBMIT' &&
            session.sourceFingerprint !== source.fingerprint
          )
            throw new ConflictException(
              'Statement, ledger or matching evidence changed. Return the session for fresh preparation and review.',
            );
          if (duty === 'SUBMIT')
            data = {
              status: 'SUBMITTED',
              submittedAt: new Date(),
              submittedById: actor.userId,
              sourceFingerprint: source.fingerprint,
              sourceSnapshot: source.snapshot,
              openingBookBalance: source.openingBookBalance,
              closingBookBalance: source.closingBookBalance,
              difference: source.difference,
            };
          else {
            if (source.issues.length)
              throw new ConflictException({
                code: 'RECONCILIATION_EXCEPTIONS_UNRESOLVED',
                message:
                  'Resolve reconciliation exceptions before review or finalization',
                issues: source.issues,
              });
            data =
              duty === 'REVIEW'
                ? {
                    status: 'REVIEWED',
                    reviewedAt: new Date(),
                    reviewedById: actor.userId,
                    reviewReason: note,
                  }
                : {
                    status: 'FINALIZED',
                    finalizedAt: new Date(),
                    finalizedById: actor.userId,
                  };
          }
        }
        await this.claim(tx, session, actor, data);
        await this.history(tx, session, actor, duty.toLowerCase(), note, {
          status: data.status as string,
        });
        return this.project(await this.load(tx, id, actor), actor);
      },
    );
  }

  private async source(
    tx: Prisma.TransactionClient,
    session: Session,
    actor: AuthContext,
  ) {
    const until = new Date(session.statementTo.getTime() + DAY);
    const account = await tx.chartAccount.findFirst({
      where: {
        id: session.accountId,
        tenantId: actor.tenantId,
        isActive: true,
        type: 'ASSET',
      },
      select: { id: true },
    });
    if (!account)
      throw new ConflictException('Reconciliation account is no longer active');
    // Reversed originals remain ledger history; their posted reversals offset them.
    const journalWhere = {
      tenantId: actor.tenantId,
      chartAccountId: session.accountId,
      journalEntry: {
        tenantId: actor.tenantId,
        status: { in: ['POSTED', 'REVERSED'] as Array<'POSTED' | 'REVERSED'> },
      },
    };
    const [openingTotals, statements, lines] = await Promise.all([
      tx.journalLine.aggregate({
        where: {
          ...journalWhere,
          journalEntry: {
            ...journalWhere.journalEntry,
            entryDate: { lt: session.statementFrom },
          },
        },
        _sum: { debit: true, credit: true },
      }),
      tx.bankStatement.findMany({
        where: {
          tenantId: actor.tenantId,
          accountId: session.accountId,
          statementDate: { gte: session.statementFrom, lt: until },
        },
        orderBy: { id: 'asc' },
        take: MAX_SOURCE_ROWS + 1,
      }),
      tx.journalLine.findMany({
        where: {
          ...journalWhere,
          journalEntry: {
            ...journalWhere.journalEntry,
            entryDate: { gte: session.statementFrom, lt: until },
          },
        },
        include: {
          journalEntry: {
            select: { status: true, entryDate: true, narration: true },
          },
        },
        orderBy: { id: 'asc' },
        take: MAX_SOURCE_ROWS + 1,
      }),
    ]);
    if (statements.length > MAX_SOURCE_ROWS || lines.length > MAX_SOURCE_ROWS)
      throw new BadRequestException(
        'Use a smaller reconciliation date range (maximum 5,000 source rows)',
      );
    const openingBookBalance = new Prisma.Decimal(
      openingTotals._sum.debit ?? 0,
    ).minus(openingTotals._sum.credit ?? 0);
    const closingBookBalance = lines.reduce(
      (sum, row) => sum.plus(row.debit).minus(row.credit),
      openingBookBalance,
    );
    const bankMovement = statements.reduce(
      (sum, row) => sum.plus(row.debitAmount).minus(row.creditAmount),
      new Prisma.Decimal(0),
    );
    const difference = closingBookBalance.minus(session.closingBankBalance);
    const matches = session.matches.filter((row) => row.status === 'MATCHED');
    const statementMap = new Map(statements.map((row) => [row.id, row]));
    const lineMap = new Map(lines.map((row) => [row.id, row]));
    const validMatches = matches.filter((match) => {
      const statement = statementMap.get(match.bankStatementId);
      const line = lineMap.get(match.journalLineId ?? '');
      return (
        statement &&
        line &&
        statement.isReconciled &&
        statement.journalLineId === line.id &&
        line.journalEntry.status === 'POSTED' &&
        statement.debitAmount
          .minus(statement.creditAmount)
          .eq(match.bankAmount) &&
        line.debit.minus(line.credit).eq(match.bookAmount) &&
        match.bankAmount.eq(match.bookAmount)
      );
    });
    const matchedStatements = new Set(
      validMatches.map((row) => row.bankStatementId),
    );
    const matchedLines = new Set(validMatches.map((row) => row.journalLineId));
    const issues: string[] = [];
    if (!statements.length)
      issues.push('No bank statement lines exist for this range.');
    if (
      !session.openingBankBalance
        .plus(bankMovement)
        .eq(session.closingBankBalance)
    )
      issues.push(
        'Reported closing bank balance does not agree with statement movements.',
      );
    if (!openingBookBalance.eq(session.openingBankBalance))
      issues.push('Opening bank and book balances differ.');
    if (!difference.isZero())
      issues.push('Closing bank and book balances differ.');
    const unmatchedStatementCount = statements.filter(
      (row) => !matchedStatements.has(row.id),
    ).length;
    const unmatchedBookCount = lines.filter(
      (row) =>
        row.journalEntry.status === 'POSTED' && !matchedLines.has(row.id),
    ).length;
    if (unmatchedStatementCount)
      issues.push(
        `${unmatchedStatementCount} bank statement lines lack verified session matches.`,
      );
    if (unmatchedBookCount)
      issues.push(
        `${unmatchedBookCount} posted bank ledger lines lack verified session matches.`,
      );
    if (validMatches.length !== matches.length)
      issues.push('A recorded match no longer agrees with its source.');
    const previous = session.sourceSnapshot as {
      statementReference?: string;
    } | null;
    const snapshot = {
      statementReference: previous?.statementReference ?? null,
      openingBookBalance: openingBookBalance.toFixed(2),
      closingBookBalance: closingBookBalance.toFixed(2),
      openingBankBalance: session.openingBankBalance.toFixed(2),
      closingBankBalance: session.closingBankBalance.toFixed(2),
      difference: difference.toFixed(2),
      unmatchedStatementCount,
      unmatchedBookCount,
      issues,
      statements: statements.map((row) => ({
        id: row.id,
        date: row.statementDate.toISOString(),
        description: row.description,
        reference: row.reference,
        debit: row.debitAmount.toFixed(2),
        credit: row.creditAmount.toFixed(2),
        isReconciled: row.isReconciled,
        journalLineId: row.journalLineId,
      })),
      lines: lines.map((row) => ({
        id: row.id,
        entryId: row.journalEntryId,
        date: row.journalEntry.entryDate.toISOString(),
        status: row.journalEntry.status,
        narration: row.journalEntry.narration,
        debit: row.debit.toFixed(2),
        credit: row.credit.toFixed(2),
      })),
      matches: [...session.matches]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((row) => ({
          id: row.id,
          statementId: row.bankStatementId,
          journalLineId: row.journalLineId,
          status: row.status,
          bankAmount: row.bankAmount.toFixed(2),
          bookAmount: row.bookAmount.toFixed(2),
          matchedById: row.matchedById,
          unmatchedById: row.unmatchedById,
          reason: row.unmatchReason,
        })),
    };
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(snapshot))
      .digest('hex');
    return {
      snapshot,
      fingerprint,
      openingBookBalance,
      closingBookBalance,
      difference,
      issues,
    };
  }
  private project(session: Session, actor: AuthContext) {
    const snapshot = session.sourceSnapshot as {
      statementReference?: string;
      issues?: string[];
      unmatchedStatementCount?: number;
      unmatchedBookCount?: number;
    } | null;
    return {
      id: session.id,
      accountId: session.accountId,
      fiscalPeriodId: session.fiscalPeriodId,
      statementFrom: session.statementFrom.toISOString(),
      statementTo: session.statementTo.toISOString(),
      status: session.status,
      revision: session.revision,
      statementReference: snapshot?.statementReference ?? null,
      openingBookBalance: session.openingBookBalance.toFixed(2),
      closingBookBalance: session.closingBookBalance.toFixed(2),
      openingBankBalance: session.openingBankBalance.toFixed(2),
      closingBankBalance: session.closingBankBalance.toFixed(2),
      difference: session.difference.toFixed(2),
      createdById: session.createdById,
      submittedById: session.submittedById,
      reviewedById: session.reviewedById,
      reviewReason: session.reviewReason,
      finalizedById: session.finalizedById,
      finalizedAt: session.finalizedAt?.toISOString() ?? null,
      issues: snapshot?.issues ?? [],
      unmatchedStatementCount: snapshot?.unmatchedStatementCount ?? 0,
      unmatchedBookCount: snapshot?.unmatchedBookCount ?? 0,
      matches: session.matches.map((row) => ({
        id: row.id,
        statementId: row.bankStatementId,
        journalLineId: row.journalLineId,
        status: row.status,
        bankAmount: row.bankAmount.toFixed(2),
        bookAmount: row.bookAmount.toFixed(2),
        reason: row.unmatchReason,
      })),
      history: session.history.map((row) => ({
        id: row.id,
        action: row.action,
        actorUserId: row.actorUserId,
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
      })),
      allowedActions: reconciliationAllowedActions(actor, session),
    };
  }
}
function requiredReason(value: string | undefined) {
  const note = value?.trim();
  if (!note || note.length < 10 || note.length > 500)
    throw new BadRequestException('A reason of 10–500 characters is required');
  return note;
}
function dateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException('An unambiguous YYYY-MM-DD date is required');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('Invalid statement date');
  return date;
}
function money(value: string) {
  if (typeof value !== 'string' || !/^-?\d{1,16}(\.\d{1,2})?$/.test(value))
    throw new BadRequestException(
      'Bank balances must be precise decimal strings with at most two decimal places',
    );
  return new Prisma.Decimal(value);
}

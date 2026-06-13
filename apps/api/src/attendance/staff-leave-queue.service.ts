import { Injectable } from '@nestjs/common';
import { LeaveRequestStatus } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StaffLeaveQueueService {
  constructor(private readonly prisma: PrismaService) {}

  async getApprovalQueueDepth(actor: AuthContext, staleDaysInput?: string) {
    const staleDays = clampDays(staleDaysInput, 7);
    const staleBefore = new Date(Date.now() - staleDays * 86_400_000);
    const pending = await this.prisma.staffLeaveRequest.findMany({
      where: {
        tenantId: actor.tenantId,
        status: LeaveRequestStatus.PENDING,
      },
      include: {
        staff: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            department: true,
            designation: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
      take: 500,
    });

    const byLeaveType = countBy(pending, (request) => request.leaveType);
    const byDepartment = countBy(
      pending,
      (request) => request.staff.department ?? 'Unassigned',
    );

    return {
      pending: pending.length,
      staleDays,
      stalePending: pending.filter((request) => request.createdAt <= staleBefore)
        .length,
      oldestPendingAt: pending[0]?.createdAt ?? null,
      byLeaveType,
      byDepartment,
      preview: pending.slice(0, 25).map((request) => ({
        id: request.id,
        staffId: request.staffId,
        employeeId: request.staff.employeeId,
        staffName: `${request.staff.firstName} ${request.staff.lastName}`,
        department: request.staff.department,
        designation: request.staff.designation,
        leaveType: request.leaveType,
        isPaid: request.isPaid,
        startsOn: request.startsOn,
        endsOn: request.endsOn,
        days: Number(request.days),
        createdAt: request.createdAt,
      })),
    };
  }
}

function clampDays(input: string | undefined, fallback: number) {
  const parsed = input ? Number(input) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), 90);
}

function countBy<T>(items: T[], pickKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = pickKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

export const AUTHORITY_FENCED_CODE = 'AUTHORITY_FENCED';
export const DEFAULT_AUTHORITY_NODE_ID = 'cloud';
export const DEFAULT_AUTHORITY_EPOCH = 1;

export type ClientAuthorityFence = {
  authorityNodeId?: string;
  authorityEpoch?: number;
};

export type SchoolAuthorityFence = {
  authorityNodeId: string;
  authorityEpoch: number;
};

export async function getOrCreateTenantAuthorityFence(
  prisma: PrismaService,
  tenantId: string,
): Promise<SchoolAuthorityFence> {
  const existing = await prisma.tenantAuthorityFence.findUnique({
    where: { tenantId },
  });
  if (existing) {
    return {
      authorityNodeId: existing.authorityNodeId,
      authorityEpoch: existing.authorityEpoch,
    };
  }

  try {
    const created = await prisma.tenantAuthorityFence.create({
      data: {
        tenantId,
        authorityNodeId: DEFAULT_AUTHORITY_NODE_ID,
        authorityEpoch: DEFAULT_AUTHORITY_EPOCH,
      },
    });
    return {
      authorityNodeId: created.authorityNodeId,
      authorityEpoch: created.authorityEpoch,
    };
  } catch (error) {
    const databaseError = error as { code?: string };
    if (databaseError.code === 'P2002') {
      const winner = await prisma.tenantAuthorityFence.findUnique({
        where: { tenantId },
      });
      if (winner) {
        return {
          authorityNodeId: winner.authorityNodeId,
          authorityEpoch: winner.authorityEpoch,
        };
      }
    }
    throw error;
  }
}

export async function assertClientAuthorityFence(
  prisma: PrismaService,
  tenantId: string,
  client?: ClientAuthorityFence,
): Promise<SchoolAuthorityFence> {
  const fence = await getOrCreateTenantAuthorityFence(prisma, tenantId);
  const providedNode = client?.authorityNodeId?.trim();
  const providedEpoch = client?.authorityEpoch;

  if (!providedNode && providedEpoch == null) {
    return fence;
  }

  if (!providedNode || providedEpoch == null) {
    throw createAuthorityFencedException();
  }

  if (
    providedNode !== fence.authorityNodeId ||
    providedEpoch !== fence.authorityEpoch
  ) {
    throw createAuthorityFencedException();
  }

  return fence;
}

function createAuthorityFencedException() {
  return new ConflictException({
    statusCode: 409,
    code: AUTHORITY_FENCED_CODE,
    message:
      'This device is not the current school authority. Reconnect to the active SchoolOS node before finalizing this record.',
  });
}

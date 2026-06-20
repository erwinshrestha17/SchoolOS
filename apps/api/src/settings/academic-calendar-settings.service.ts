import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NEPAL_TIME_ZONE,
  formatBsAcademicYear,
  formatBsDateForInput,
  parseBsDateInput,
  toGregorianDateFromBs,
  zonedNepalDateTimeToUtc,
  type AcademicCalendarSettings,
} from '@schoolos/core';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAcademicCalendarYearDto } from './dto/create-academic-calendar-year.dto';
import { UpsertSchoolCalendarDaySettingsDto } from './dto/upsert-school-calendar-day.dto';

@Injectable()
export class AcademicCalendarSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getCalendar(
    tenantId: string,
    academicYearId?: string,
  ): Promise<AcademicCalendarSettings> {
    const academicYears = await this.prisma.academicYear.findMany({
      where: { tenantId },
      orderBy: [{ isCurrent: 'desc' }, { startsOn: 'desc' }],
      take: 100,
    });
    const selected = academicYearId
      ? academicYears.find((year) => year.id === academicYearId)
      : (academicYears.find((year) => year.isCurrent) ?? academicYears[0]);

    if (academicYearId && !selected) {
      throw new NotFoundException(
        'Academic year was not found in this school.',
      );
    }

    const calendarDays = selected
      ? await this.prisma.schoolCalendarDay.findMany({
          where: {
            tenantId,
            calendarDate: { gte: selected.startsOn, lte: selected.endsOn },
          },
          orderBy: { calendarDate: 'asc' },
          take: 400,
        })
      : [];

    return {
      timeZone: NEPAL_TIME_ZONE,
      academicYears: academicYears.map((year) => ({
        id: year.id,
        name: year.name,
        displayName: computedBsAcademicYearLabel(year.startsOn),
        startsOnBs: formatBsDateForInput(year.startsOn),
        endsOnBs: formatBsDateForInput(year.endsOn),
        isCurrent: year.isCurrent,
      })),
      selectedAcademicYearId: selected?.id ?? null,
      calendarDays: calendarDays.map((day) => ({
        id: day.id,
        calendarDateBs: formatBsDateForInput(day.calendarDate),
        isWorkingDay: day.isWorkingDay,
        label: day.label,
        holidayType: day.holidayType,
        category: categorizeCalendarDay(day.isWorkingDay, day.holidayType),
      })),
    };
  }

  async createAcademicYear(
    tenantId: string,
    dto: CreateAcademicCalendarYearDto,
    userId: string,
  ) {
    const name =
      dto.name.trim() || formatBsAcademicYear(parseBsDateInput(dto.startsOnBs));
    if (!name) throw new BadRequestException('Academic year name is required.');

    const startsOn = toNepalSchoolDateUtc(dto.startsOnBs);
    const endsOn = toNepalSchoolDateUtc(dto.endsOnBs);
    if (startsOn >= endsOn) {
      throw new BadRequestException(
        'Academic year end date must be after the start date.',
      );
    }

    const academicYear = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.academicYear.findUnique({
        where: { tenantId_name: { tenantId, name } },
        select: { id: true },
      });
      if (existing)
        throw new ConflictException('This academic year already exists.');

      const overlapping = await tx.academicYear.findFirst({
        where: {
          tenantId,
          startsOn: { lte: endsOn },
          endsOn: { gte: startsOn },
        },
        select: { id: true, name: true },
      });
      if (overlapping) {
        throw new ConflictException(
          `Academic year overlaps with ${overlapping.name}.`,
        );
      }

      if (dto.isCurrent) {
        await tx.academicYear.updateMany({
          where: { tenantId, isCurrent: true },
          data: { isCurrent: false },
        });
      }

      return tx.academicYear.create({
        data: {
          tenantId,
          name,
          startsOn,
          endsOn,
          isCurrent: dto.isCurrent ?? false,
        },
      });
    });

    await this.auditService.record({
      action: 'academic_calendar_year_created',
      resource: 'academic_year',
      resourceId: academicYear.id,
      tenantId,
      userId,
      after: {
        name: academicYear.name,
        startsOnBs: dto.startsOnBs,
        endsOnBs: dto.endsOnBs,
        isCurrent: academicYear.isCurrent,
      },
    });

    return {
      id: academicYear.id,
      name: academicYear.name,
      displayName: computedBsAcademicYearLabel(academicYear.startsOn),
      startsOnBs: formatBsDateForInput(academicYear.startsOn),
      endsOnBs: formatBsDateForInput(academicYear.endsOn),
      isCurrent: academicYear.isCurrent,
    };
  }

  async setCurrentAcademicYear(
    tenantId: string,
    academicYearId: string,
    userId: string,
  ) {
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
      select: {
        id: true,
        name: true,
        startsOn: true,
        endsOn: true,
        isCurrent: true,
      },
    });
    if (!academicYear) {
      throw new NotFoundException(
        'Academic year was not found in this school.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.academicYear.updateMany({
        where: { tenantId, isCurrent: true, id: { not: academicYearId } },
        data: { isCurrent: false },
      });
      await tx.academicYear.update({
        where: { id: academicYearId },
        data: { isCurrent: true },
      });
    });

    await this.auditService.record({
      action: 'academic_calendar_year_set_current',
      resource: 'academic_year',
      resourceId: academicYear.id,
      tenantId,
      userId,
      after: {
        name: academicYear.name,
        startsOnBs: formatBsDateForInput(academicYear.startsOn),
        endsOnBs: formatBsDateForInput(academicYear.endsOn),
        isCurrent: true,
      },
    });

    return {
      id: academicYear.id,
      name: academicYear.name,
      displayName: computedBsAcademicYearLabel(academicYear.startsOn),
      startsOnBs: formatBsDateForInput(academicYear.startsOn),
      endsOnBs: formatBsDateForInput(academicYear.endsOn),
      isCurrent: true,
    };
  }

  async upsertCalendarDay(
    tenantId: string,
    dto: UpsertSchoolCalendarDaySettingsDto,
    userId: string,
  ) {
    const calendarDate = toNepalSchoolDateUtc(dto.calendarDateBs);
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: dto.academicYearId, tenantId },
      select: { startsOn: true, endsOn: true },
    });
    if (!academicYear) {
      throw new NotFoundException(
        'Academic year was not found in this school.',
      );
    }
    if (
      calendarDate < academicYear.startsOn ||
      calendarDate > academicYear.endsOn
    ) {
      throw new BadRequestException(
        'Calendar day must fall within the selected academic year.',
      );
    }
    if (!dto.isWorkingDay && !cleanOptional(dto.label)) {
      throw new BadRequestException(
        'Reason or label is required for non-working days.',
      );
    }

    const day = await this.prisma.schoolCalendarDay.upsert({
      where: { tenantId_calendarDate: { tenantId, calendarDate } },
      update: {
        isWorkingDay: dto.isWorkingDay,
        label: cleanOptional(dto.label),
        holidayType: cleanOptional(dto.holidayType),
      },
      create: {
        tenantId,
        calendarDate,
        isWorkingDay: dto.isWorkingDay,
        label: cleanOptional(dto.label),
        holidayType: cleanOptional(dto.holidayType),
      },
    });

    await this.auditService.record({
      action: 'school_calendar_day_upserted',
      resource: 'school_calendar_day',
      resourceId: day.id,
      tenantId,
      userId,
      after: {
        academicYearId: dto.academicYearId,
        calendarDateBs: dto.calendarDateBs,
        isWorkingDay: day.isWorkingDay,
        holidayType: day.holidayType,
      },
    });

    return {
      id: day.id,
      calendarDateBs: formatBsDateForInput(day.calendarDate),
      isWorkingDay: day.isWorkingDay,
      label: day.label,
      holidayType: day.holidayType,
      category: categorizeCalendarDay(day.isWorkingDay, day.holidayType),
    };
  }
}

function toNepalSchoolDateUtc(bsDate: string): Date {
  try {
    return zonedNepalDateTimeToUtc(toGregorianDateFromBs(bsDate));
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error ? error.message : 'Invalid Bikram Sambat date.',
    );
  }
}

function cleanOptional(value?: string | null): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function computedBsAcademicYearLabel(startsOn: Date): string {
  return formatBsAcademicYear(parseBsDateInput(formatBsDateForInput(startsOn)));
}

function categorizeCalendarDay(
  isWorkingDay: boolean,
  holidayType?: string | null,
):
  | 'WORKING_DAY'
  | 'HOLIDAY'
  | 'WORKING_DAY_EXCEPTION'
  | 'SCHOOL_EVENT'
  | 'CLOSURE' {
  const normalized = holidayType?.trim().toLowerCase() ?? '';
  if (isWorkingDay && normalized) return 'WORKING_DAY_EXCEPTION';
  if (normalized.includes('event')) return 'SCHOOL_EVENT';
  if (normalized.includes('closure') || normalized.includes('closed'))
    return 'CLOSURE';
  if (!isWorkingDay) return 'HOLIDAY';
  return 'WORKING_DAY';
}

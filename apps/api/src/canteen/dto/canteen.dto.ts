import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class CreateCanteenMenuItemDto {
  @IsString() name!: string;
  @IsString() category!: string;
  @IsOptional() @IsString() description?: string;
  @IsNumber() @Min(0) unitPrice!: number;
  @IsOptional() @IsBoolean() isMealItem?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  allergenTags?: string[];
}

export class UpdateCanteenMenuItemDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @Min(0) unitPrice?: number;
  @IsOptional() @IsBoolean() isMealItem?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  allergenTags?: string[];
}

export class UpdateCanteenStatusDto {
  @IsString() status!: string;
  @IsOptional() @IsString() reason?: string;
}

export class CreateCanteenMealPlanDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() mealType!: string;
  @IsNumber() @Min(0) price!: number;
  @IsOptional() @IsString() billingFrequency?: string;
  @IsOptional() @IsBoolean() duplicateServingPrevention?: boolean;
}

export class UpdateCanteenMealPlanDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() mealType?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsString() billingFrequency?: string;
  @IsOptional() @IsBoolean() duplicateServingPrevention?: boolean;
}

export class EnrollCanteenStudentDto {
  @IsString() studentId!: string;
  @IsString() mealPlanId!: string;
  @IsDateString() startsOn!: string;
  @IsOptional() @IsDateString() endsOn?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateCanteenEnrollmentDto {
  @IsOptional() @IsString() mealPlanId?: string;
  @IsOptional() @IsDateString() startsOn?: string;
  @IsOptional() @IsDateString() endsOn?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
}

export class ServeCanteenMealDto {
  @IsString() studentId!: string;
  @IsOptional() @IsString() enrollmentId?: string;
  @IsOptional() @IsString() mealPlanId?: string;
  @IsOptional() @IsString() mealType?: string;
  @IsOptional() @IsDateString() mealDate?: string;
  @IsOptional() @IsBoolean() preventDuplicate?: boolean;
  @IsOptional() @IsString() notes?: string;
}

export class TopUpCanteenWalletDto {
  @IsNumber() @Min(1) amount!: number;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() idempotencyKey?: string;
  @IsOptional() @IsNumber() @Min(0) lowBalanceThreshold?: number;
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: PaymentMethod;
}

export class CreateCanteenPosSaleItemDto {
  @IsString() menuItemId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class CreateCanteenPosSaleDto {
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() staffId?: string;
  @IsString() paymentMethod!: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() idempotencyKey?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCanteenPosSaleItemDto)
  items!: CreateCanteenPosSaleItemDto[];
}

export class CompleteCanteenPosSaleDto {
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() overrideReason?: string;
}

export class UpsertCanteenSpendingControlDto {
  @IsString() studentId!: string;
  @IsOptional() @IsNumber() @Min(0) dailySpendingLimit?: number;
  @IsOptional() @IsNumber() @Min(0) monthlySpendingLimit?: number;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  blockedCategories?: string[];
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  blockedMenuItemIds?: string[];
  @IsOptional() @IsNumber() @Min(0) lowBalanceThreshold?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

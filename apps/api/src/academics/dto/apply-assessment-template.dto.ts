import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export const ASSESSMENT_TEMPLATE_KEYS = [
  'basic-terminal',
  'theory-practical',
] as const;
export type AssessmentTemplateKey = (typeof ASSESSMENT_TEMPLATE_KEYS)[number];

export class ApplyAssessmentTemplateDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  classId!: string;

  @IsIn(ASSESSMENT_TEMPLATE_KEYS)
  templateKey!: AssessmentTemplateKey;

  @IsString()
  startsOn!: string;

  @IsString()
  endsOn!: string;

  @IsOptional()
  @IsString()
  examTermName?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  subjectIds?: string[];

  @IsOptional()
  @IsString()
  reason?: string;
}

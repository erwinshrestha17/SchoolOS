import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CloseFiscalYearDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;

  /**
   * Phase 7.11d: the fingerprint of the close preview the user reviewed. The
   * close is refused (409 CLOSE_PREVIEW_REQUIRED / CLOSE_PREVIEW_STALE) when
   * it is missing or the inventory changed since.
   */
  @IsOptional()
  @Matches(/^[0-9a-f]{64}$/, {
    message: 'expectedPreviewFingerprint must come from the close preview',
  })
  expectedPreviewFingerprint?: string;

  /** Every warning code in the preview must be acknowledged. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  acknowledgedWarningCodes?: string[];
}

import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class AssignRoleDto {
  @IsString()
  userId!: string;

  @IsArray()
  @IsString({ each: true })
  roleIds!: string[];

  /**
   * Required when the change removes the School Configuration Owner role
   * from a user. Recorded in the tenant audit trail.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

import { IsArray, IsString } from 'class-validator';

export class AssignRoleDto {
  @IsString()
  userId!: string;

  @IsArray()
  @IsString({ each: true })
  roleIds!: string[];
}

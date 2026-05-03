import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { SystemRole } from '@prisma/client';

export class GroupAccountAssignmentDto {
  @IsString()
  accountId!: string;

  @IsEnum(SystemRole)
  role!: SystemRole;
}

export class CreateGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string;

  @IsArray()
  @IsEnum(SystemRole, { each: true })
  @ArrayUnique()
  @IsOptional()
  systemRoles?: SystemRole[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupAccountAssignmentDto)
  @IsOptional()
  accountAssignments?: GroupAccountAssignmentDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  memberEmails?: string[];
}

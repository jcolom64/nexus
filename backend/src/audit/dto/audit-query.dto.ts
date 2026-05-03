import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AuditAction, AuditCategory, AuditOutcome } from '@prisma/client';

export class AuditQueryDto {
  @IsEnum(AuditCategory)
  @IsOptional()
  category?: AuditCategory;

  @IsEnum(AuditAction)
  @IsOptional()
  action?: AuditAction;

  @IsEnum(AuditOutcome)
  @IsOptional()
  outcome?: AuditOutcome;

  // Free-text match against actor / resource / source.
  @IsString()
  @IsOptional()
  search?: string;

  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  pageSize?: number = 25;
}

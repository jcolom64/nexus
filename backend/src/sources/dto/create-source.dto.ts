import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { SourceStatus, SourceType } from '@prisma/client';

export class CreateSourceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name!: string;

  @IsEnum(SourceType)
  type!: SourceType;

  @IsOptional()
  @IsEnum(SourceStatus)
  status?: SourceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  host?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  database?: string;
}

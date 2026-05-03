import { ArrayUnique, IsArray, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole, UserState } from '@prisma/client';

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsEnum(UserState)
  @IsOptional()
  state?: UserState;

  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  @IsOptional()
  groupIds?: string[];
}

import { ArrayUnique, IsArray, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole, UserState } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @MinLength(8)
  password!: string;

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

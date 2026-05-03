import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Self-edit DTO. Deliberately a strict subset of UpdateUserDto: a user
// editing their own record can change their display name and nothing else.
// Role / state / email / password / group membership are admin-only via
// `PATCH /users/:id` (and password belongs in a future change-password flow).
export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name?: string;
}

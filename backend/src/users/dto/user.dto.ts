import { UserRole, UserState } from '@prisma/client';

// Public projection — never includes the password hash.
export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  state: UserState;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  groups: { id: string; name: string }[];
}

import { UserRole } from '@/domain/users/types/user.type';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

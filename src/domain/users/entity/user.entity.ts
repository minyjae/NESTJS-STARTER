import { BaseEntity } from '@/shared/entities/base.entity';
import { UserRole } from '@/domain/users/types/user.type';

export class UserEntity extends BaseEntity {
  email: string;
  name: string | null;
  password: string | null;
  role: UserRole;
}

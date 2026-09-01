export type UserRole = 'USER' | 'ADMIN';

export interface SafeUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface UserWithPassword extends SafeUser {
  password: string | null;
}

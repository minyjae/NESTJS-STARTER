import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  passwordHash: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
}

@Injectable()
export class UsersService {
  private readonly users = new Map<string, User>();

  async create(input: CreateUserInput): Promise<User> {
    const normalizedEmail = input.email.toLowerCase();
    const existingUser = this.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new ConflictException('Email is already in use');
    }

    const user: User = {
      id: randomUUID(),
      email: normalizedEmail,
      name: input.name ?? null,
      role: 'USER',
      passwordHash: await bcrypt.hash(input.password, 10),
    };

    this.users.set(user.id, user);
    return user;
  }

  findByEmail(email: string): User | null {
    const normalizedEmail = email.toLowerCase();
    return (
      Array.from(this.users.values()).find((user) => user.email === normalizedEmail) ?? null
    );
  }
}

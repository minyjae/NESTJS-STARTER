import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRepository } from '@/domain/users/infrastructure/user.repository';
import { USER_REPOSITORY } from '@/domain/users/infrastructure/user.repository-token';
import { UsersService } from './users.service';

const now = new Date('2026-01-01T00:00:00.000Z');
const user = {
  id: '8ed17958-861a-4866-90fd-ac6df7163745',
  email: 'user@example.com',
  name: 'User',
  password: '$2b$10$z0iRb2tGpNnoBB/LdZxgsuBYrYQkSl4ehwiXQO4NEbHKeRsiFXGXS',
  role: 'USER' as const,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      findMany: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: USER_REPOSITORY,
          useValue: repository,
        },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  it('creates a user without exposing the password', async () => {
    repository.findByEmail.mockResolvedValue(null);
    repository.create.mockResolvedValue(user);

    const created = await service.create({
      email: 'user@example.com',
      name: 'User',
      password: 'password123',
    });

    const createPayload = repository.create.mock.calls[0]?.[0];

    expect(createPayload).toMatchObject({ email: 'user@example.com' });
    expect(typeof createPayload?.password).toBe('string');
    expect(created).not.toHaveProperty('password');
    expect(created.email).toBe(user.email);
  });

  it('throws when creating a duplicate email', async () => {
    repository.findByEmail.mockResolvedValue(user);

    await expect(
      service.create({
        email: 'user@example.com',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('finds a user by id', async () => {
    repository.findById.mockResolvedValue(user);

    await expect(service.findById(user.id)).resolves.toMatchObject({
      id: user.id,
      email: user.email,
    });
  });

  it('throws when a user cannot be found', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.findById(user.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});

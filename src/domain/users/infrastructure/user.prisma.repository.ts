import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { CreateUserDto } from '@/domain/users/dto/create-user.dto';
import { UpdateUserDto } from '@/domain/users/dto/update-user.dto';
import { UserQueryDto } from '@/domain/users/dto/user-query.dto';
import { UserEntity } from '@/domain/users/entity/user.entity';
import { UserRepository } from '@/domain/users/infrastructure/user.repository';
import { buildPaginationMeta, getPaginationSkip } from '@/shared/utils/pagination.util';
import { buildOrderBy, normalizeSearch } from '@/shared/utils/query.util';
import { PrismaService } from '@/shared/services/prisma/prisma.service';

const ALLOWED_ORDER_FIELDS = ['email', 'name', 'createdAt', 'updatedAt'] as const;

@Injectable()
export class UserPrismaRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUserDto): Promise<UserEntity> {
    const user = await this.prisma.user.create({ data });
    return this.toEntity(user);
  }

  async findMany(query: UserQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 10;
    const search = normalizeSearch(query.search);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.role ? { role: query.role } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: getPaginationSkip(page, perPage),
        take: perPage,
        orderBy: buildOrderBy(
          query.orderBy ?? query.sortBy,
          query.orderDirection,
          ALLOWED_ORDER_FIELDS,
          { createdAt: 'desc' },
        ),
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((user) => this.toEntity(user)),
      meta: buildPaginationMeta(total, page, perPage),
    };
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    return user ? this.toEntity(user) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    return user ? this.toEntity(user) : null;
  }

  async update(id: string, data: UpdateUserDto): Promise<UserEntity> {
    const user = await this.prisma.user.update({
      where: { id },
      data,
    });

    return this.toEntity(user);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private toEntity(user: User): UserEntity {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      password: user.password,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }
}

import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '@/domain/users/dto/create-user.dto';
import { UpdateUserDto } from '@/domain/users/dto/update-user.dto';
import { UserQueryDto } from '@/domain/users/dto/user-query.dto';
import { UserResponseDto } from '@/domain/users/dto/user-response.dto';
import { UserEntity } from '@/domain/users/entity/user.entity';
import { UserRepository } from '@/domain/users/infrastructure/user.repository';
import { USER_REPOSITORY } from '@/domain/users/infrastructure/user.repository-token';
import { PaginatedResult } from '@/shared/interfaces/pagination.interface';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const existingUser = await this.userRepository.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictException('Email is already in use');
    }

    const password = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;
    const user = await this.userRepository.create({ ...dto, password });
    return this.toResponse(user);
  }

  async findMany(query: UserQueryDto): Promise<PaginatedResult<UserResponseDto>> {
    const result = await this.userRepository.findMany(query);
    return {
      items: result.items.map((user) => this.toResponse(user)),
      meta: result.meta,
    };
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.findEntityById(id);
    return this.toResponse(user);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findByEmail(email);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    await this.findEntityById(id);
    const password = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;
    const user = await this.userRepository.update(id, { ...dto, password });
    return this.toResponse(user);
  }

  async delete(id: string): Promise<void> {
    await this.findEntityById(id);
    await this.userRepository.softDelete(id);
  }

  private async findEntityById(id: string): Promise<UserEntity> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private toResponse(user: UserEntity): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

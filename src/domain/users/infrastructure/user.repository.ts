import { CreateUserDto } from '@/domain/users/dto/create-user.dto';
import { UpdateUserDto } from '@/domain/users/dto/update-user.dto';
import { UserQueryDto } from '@/domain/users/dto/user-query.dto';
import { UserEntity } from '@/domain/users/entity/user.entity';
import { PaginatedResult } from '@/shared/interfaces/pagination.interface';

export interface UserRepository {
  create(data: CreateUserDto): Promise<UserEntity>;
  findMany(query: UserQueryDto): Promise<PaginatedResult<UserEntity>>;
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  update(id: string, data: UpdateUserDto): Promise<UserEntity>;
  softDelete(id: string): Promise<void>;
}

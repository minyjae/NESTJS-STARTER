import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '@/shared/dto/pagination-query.dto';
import { UserRole } from '@/domain/users/types/user.type';

export class UserQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['USER', 'ADMIN'])
  role?: UserRole;
}

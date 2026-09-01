import { Module } from '@nestjs/common';
import { USER_REPOSITORY } from '@/domain/users/infrastructure/user.repository-token';
import { UserPrismaRepository } from '@/domain/users/infrastructure/user.prisma.repository';
import { UsersController } from '@/domain/users/presentation/users.controller';
import { UsersService } from '@/domain/users/service/users.service';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: USER_REPOSITORY,
      useClass: UserPrismaRepository,
    },
  ],
  exports: [UsersService, USER_REPOSITORY],
})
export class UsersModule {}

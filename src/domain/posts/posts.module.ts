import { Module } from '@nestjs/common';
import { POST_REPOSITORY } from '@/domain/posts/infrastructure/post.repository-token';
import { PostPrismaRepository } from '@/domain/posts/infrastructure/post.prisma.repository';
import { PostsController } from '@/domain/posts/presentation/posts.controller';
import { PostsService } from '@/domain/posts/service/posts.service';

@Module({
  controllers: [PostsController],
  providers: [
    PostsService,
    {
      provide: POST_REPOSITORY,
      useClass: PostPrismaRepository,
    },
  ],
  exports: [PostsService, POST_REPOSITORY],
})
export class PostsModule {}

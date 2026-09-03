import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePostDto } from '@/domain/posts/dto/create-post.dto';
import { PostQueryDto } from '@/domain/posts/dto/post-query.dto';
import { PostResponseDto } from '@/domain/posts/dto/post-response.dto';
import { UpdatePostDto } from '@/domain/posts/dto/update-post.dto';
import { PostEntity } from '@/domain/posts/entity/post.entity';
import { POST_REPOSITORY } from '@/domain/posts/infrastructure/post.repository-token';
import { PostRepository } from '@/domain/posts/infrastructure/post.repository';
import { PaginatedResult } from '@/shared/interfaces/pagination.interface';

@Injectable()
export class PostsService {
  constructor(
    @Inject(POST_REPOSITORY)
    private readonly postRepository: PostRepository,
  ) {}

  async create(dto: CreatePostDto): Promise<PostResponseDto> {
    const post = await this.postRepository.create(dto);
    return this.toResponse(post);
  }

  async findMany(query: PostQueryDto): Promise<PaginatedResult<PostResponseDto>> {
    const result = await this.postRepository.findMany(query);
    return {
      items: result.items.map((post) => this.toResponse(post)),
      meta: result.meta,
    };
  }

  async findById(id: string): Promise<PostResponseDto> {
    const post = await this.findEntityById(id);
    return this.toResponse(post);
  }

  async update(id: string, dto: UpdatePostDto): Promise<PostResponseDto> {
    await this.findEntityById(id);
    const post = await this.postRepository.update(id, dto);
    return this.toResponse(post);
  }

  async delete(id: string): Promise<void> {
    await this.findEntityById(id);
    await this.postRepository.softDelete(id);
  }

  private async findEntityById(id: string): Promise<PostEntity> {
    const post = await this.postRepository.findById(id);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  private toResponse(post: PostEntity): PostResponseDto {
    return {
      id: post.id,
      title: post.title,
      content: post.content,
      published: post.published,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}

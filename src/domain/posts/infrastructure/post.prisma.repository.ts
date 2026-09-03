import { Injectable } from '@nestjs/common';
import { Post, Prisma } from '@prisma/client';
import { CreatePostDto } from '@/domain/posts/dto/create-post.dto';
import { PostQueryDto } from '@/domain/posts/dto/post-query.dto';
import { UpdatePostDto } from '@/domain/posts/dto/update-post.dto';
import { PostEntity } from '@/domain/posts/entity/post.entity';
import { PostRepository } from '@/domain/posts/infrastructure/post.repository';
import { PrismaService } from '@/shared/services/prisma/prisma.service';
import { PaginatedResult } from '@/shared/interfaces/pagination.interface';
import { buildPaginationMeta, getPaginationSkip } from '@/shared/utils/pagination.util';
import { buildOrderBy, normalizeSearch } from '@/shared/utils/query.util';

const ALLOWED_ORDER_FIELDS = ['title', 'published', 'createdAt', 'updatedAt'] as const;

@Injectable()
export class PostPrismaRepository implements PostRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePostDto): Promise<PostEntity> {
    const post = await this.prisma.post.create({ data });
    return this.toEntity(post);
  }

  async findMany(query: PostQueryDto): Promise<PaginatedResult<PostEntity>> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 10;
    const search = normalizeSearch(query.search);
    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      ...(query.published !== undefined ? { published: query.published } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { content: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
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
      this.prisma.post.count({ where }),
    ]);

    return {
      items: items.map((post) => this.toEntity(post)),
      meta: buildPaginationMeta(total, page, perPage),
    };
  }

  async findById(id: string): Promise<PostEntity | null> {
    const post = await this.prisma.post.findFirst({
      where: { id, deletedAt: null },
    });

    return post ? this.toEntity(post) : null;
  }

  async update(id: string, data: UpdatePostDto): Promise<PostEntity> {
    const post = await this.prisma.post.update({
      where: { id },
      data,
    });

    return this.toEntity(post);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.post.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private toEntity(post: Post): PostEntity {
    return {
      id: post.id,
      title: post.title,
      content: post.content,
      published: post.published,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      deletedAt: post.deletedAt,
    };
  }
}

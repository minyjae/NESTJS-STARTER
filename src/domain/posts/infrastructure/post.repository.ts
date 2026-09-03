import { CreatePostDto } from '@/domain/posts/dto/create-post.dto';
import { PostQueryDto } from '@/domain/posts/dto/post-query.dto';
import { UpdatePostDto } from '@/domain/posts/dto/update-post.dto';
import { PostEntity } from '@/domain/posts/entity/post.entity';
import { PaginatedResult } from '@/shared/interfaces/pagination.interface';

export interface PostRepository {
  create(data: CreatePostDto): Promise<PostEntity>;
  findMany(query: PostQueryDto): Promise<PaginatedResult<PostEntity>>;
  findById(id: string): Promise<PostEntity | null>;
  update(id: string, data: UpdatePostDto): Promise<PostEntity>;
  softDelete(id: string): Promise<void>;
}

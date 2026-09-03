import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { ParseUuidPipe } from '@/common/pipes/parse-uuid.pipe';
import { ApiResponse } from '@/common/responses/api-response';
import { CreatePostDto } from '@/domain/posts/dto/create-post.dto';
import { PostQueryDto } from '@/domain/posts/dto/post-query.dto';
import { UpdatePostDto } from '@/domain/posts/dto/update-post.dto';
import { PostsService } from '@/domain/posts/service/posts.service';

@ApiTags('posts')
@Public()
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  async findMany(@Query() query: PostQueryDto) {
    const result = await this.postsService.findMany(query);
    return ApiResponse.paginated(result.items, result.meta);
  }

  @Get(':id')
  async findById(@Param('id', ParseUuidPipe) id: string) {
    const post = await this.postsService.findById(id);
    return ApiResponse.item(post);
  }

  @Post()
  async create(@Body() dto: CreatePostDto) {
    const post = await this.postsService.create(dto);
    return ApiResponse.created(post);
  }

  @Put(':id')
  async update(@Param('id', ParseUuidPipe) id: string, @Body() dto: UpdatePostDto) {
    const post = await this.postsService.update(id, dto);
    return ApiResponse.updated(post);
  }

  @Delete(':id')
  async delete(@Param('id', ParseUuidPipe) id: string) {
    await this.postsService.delete(id);
    return ApiResponse.deleted();
  }
}

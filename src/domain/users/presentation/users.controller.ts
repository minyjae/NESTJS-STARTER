import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { ApiResponse } from '@/common/responses/api-response';
import { ParseUuidPipe } from '@/common/pipes/parse-uuid.pipe';
import { CreateUserDto } from '@/domain/users/dto/create-user.dto';
import { UpdateUserDto } from '@/domain/users/dto/update-user.dto';
import { UserQueryDto } from '@/domain/users/dto/user-query.dto';
import { UsersService } from '@/domain/users/service/users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Public()
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return ApiResponse.created(user);
  }

  @Get()
  async findMany(@Query() query: UserQueryDto) {
    const result = await this.usersService.findMany(query);
    return ApiResponse.paginated(result.items, result.meta);
  }

  @Get(':id')
  async findById(@Param('id', ParseUuidPipe) id: string) {
    const user = await this.usersService.findById(id);
    return ApiResponse.item(user);
  }

  @Patch(':id')
  async update(@Param('id', ParseUuidPipe) id: string, @Body() dto: UpdateUserDto) {
    const user = await this.usersService.update(id, dto);
    return ApiResponse.updated(user);
  }

  @Delete(':id')
  async delete(@Param('id', ParseUuidPipe) id: string) {
    await this.usersService.delete(id);
    return ApiResponse.deleted();
  }
}

import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { ApiResponse } from '@/common/responses/api-response';
import { LoginDto } from '@/domain/auth/dto/login.dto';
import { AuthService } from '@/domain/auth/service/auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const token = await this.authService.login(dto);
    return ApiResponse.item(token);
  }
}

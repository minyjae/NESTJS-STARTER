import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from '@/auth/auth.service';
import { LoginDto } from '@/auth/dto/login.dto';
import { RegisterDto } from '@/auth/dto/register.dto';
import { AuthenticatedRequest, AuthResponse } from '@/auth/types';
import { Public } from '@/common/decorators/public.decorator';
import { RawResponse } from '@/common/decorators/raw-response.decorator';

@Controller('auth')
@RawResponse()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(200)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.register(dto);
    this.setAuthCookie(response, result.accessToken);
    return result;
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.login(dto);
    this.setAuthCookie(response, result.accessToken);
    return result;
  }

  @Post('logout')
  @HttpCode(200)
  logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): { message: string } {
    if (request.user?.jti) {
      this.authService.logout(request.user.jti);
    }

    response.clearCookie('auth_token', { path: '/' });
    return { message: 'Logged out' };
  }

  private setAuthCookie(response: Response, accessToken: string): void {
    response.cookie('auth_token', accessToken, {
      httpOnly: true,
      secure: this.configService.get<string>('app.env') === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}

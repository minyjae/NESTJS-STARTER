import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { AuthService } from '@/auth/auth.service';
import { AuthenticatedRequest } from '@/auth/types';

@Injectable()
export class ValidateJwtMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  async use(
    request: AuthenticatedRequest,
    _response: Response,
    next: NextFunction,
  ): Promise<void> {
    const accessToken = this.authService.extractTokenFromRequest(request);

    if (!accessToken) {
      throw new UnauthorizedException('Missing access token');
    }

    request.user = await this.authService.validateAccessToken(accessToken);
    next();
  }
}

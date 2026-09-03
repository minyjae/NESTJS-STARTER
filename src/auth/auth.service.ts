import { randomUUID } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from '@/auth/dto/login.dto';
import { RegisterDto } from '@/auth/dto/register.dto';
import { AuthResponse, JwtPayload } from '@/auth/types';
import { User, UsersService } from '@/users/users.service';

@Injectable()
export class AuthService {
  private readonly activeSessionIds = new Set<string>();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const user = await this.usersService.create(dto);
    return this.createAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createAuthResponse(user);
  }

  logout(jti: string): void {
    this.activeSessionIds.delete(jti);
  }

  async validateAccessToken(accessToken: string): Promise<JwtPayload> {
    const payload = await this.jwtService.verifyAsync<JwtPayload>(accessToken);

    if (!payload.jti || !this.activeSessionIds.has(payload.jti)) {
      throw new UnauthorizedException('Invalid or revoked token');
    }

    return payload;
  }

  extractTokenFromRequest(request: {
    headers: { authorization?: string };
    cookies?: Record<string, string>;
  }): string | null {
    const authorization = request.headers.authorization;

    if (authorization?.startsWith('Bearer ')) {
      return authorization.slice('Bearer '.length);
    }

    return request.cookies?.auth_token ?? null;
  }

  private async createAuthResponse(user: User): Promise<AuthResponse> {
    const jti = randomUUID();
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    this.activeSessionIds.add(jti);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }
}

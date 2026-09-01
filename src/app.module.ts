import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import appConfig from '@/config/app.config';
import databaseConfig from '@/config/database.config';
import redisConfig from '@/config/redis.config';
import { envValidationSchema } from '@/config/validation';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { HttpLoggerMiddleware } from '@/common/middleware/http-logger.middleware';
import { AuthModule } from '@/domain/auth/auth.module';
import { HealthModule } from '@/domain/health/health.module';
import { UsersModule } from '@/domain/users/users.module';
import { PrismaModule } from '@/shared/services/prisma/prisma.module';
import { RedisModule } from '@/shared/services/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    UsersModule,
    AuthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}

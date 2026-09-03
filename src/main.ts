import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from '@/app.module';
import { GlobalExceptionFilter } from '@/common/filters/global-exception.filter';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const apiPrefix = configService.get<string>('app.apiPrefix') ?? '';
  const port = configService.get<number>('app.port') ?? 8000;
  const corsOrigins = configService.get<string[]>('app.corsOrigins') ?? [];
  const isProduction = configService.get<string>('app.env') === 'production';
  const enableSwagger = configService.get<boolean>('app.enableSwagger') ?? true;

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });
  if (apiPrefix) {
    app.setGlobalPrefix(apiPrefix);
  }
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter(configService));
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
  app.enableShutdownHooks();

  if (!isProduction && enableSwagger) {
    const documentConfig = new DocumentBuilder()
      .setTitle('NestJS Starter API')
      .setDescription('Reusable NestJS starter API documentation')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, documentConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(port);
  const baseUrl = apiPrefix ? `http://localhost:${port}/${apiPrefix}` : `http://localhost:${port}`;
  logger.log(`Application listening on ${baseUrl}`);
}

void bootstrap();

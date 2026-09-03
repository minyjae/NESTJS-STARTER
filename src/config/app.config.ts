import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 8000),
  apiPrefix: process.env.API_PREFIX ?? '',
  corsOrigins: (process.env.CORS_ORIGINS ?? process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  enableSwagger: process.env.ENABLE_SWAGGER !== 'false',
}));

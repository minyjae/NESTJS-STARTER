import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  queryLog: process.env.PRISMA_QUERY_LOG === 'true',
}));

import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(8000),
  API_PREFIX: Joi.string().allow('').default(''),
  DATABASE_URL: Joi.string().optional(),
  JWT_ACCESS_SECRET: Joi.string().min(8).default('change-this-secret'),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_SECRET: Joi.string().min(8).optional(),
  JWT_EXPIRES_IN: Joi.string().optional(),
  FRONTEND_ORIGIN: Joi.string().uri().default('http://localhost:3000'),
  CORS_ORIGINS: Joi.string().allow('').default(''),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().integer().min(0).default(0),
  REDIS_REQUIRED: Joi.boolean().truthy('true').falsy('false').default(false),
  CACHE_TTL_SECONDS: Joi.number().integer().positive().default(300),
  ENABLE_SWAGGER: Joi.boolean().truthy('true').falsy('false').default(true),
  PRISMA_QUERY_LOG: Joi.boolean().truthy('true').falsy('false').default(false),
});

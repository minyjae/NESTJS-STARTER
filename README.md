# NestJS Starter

Production-ready NestJS starter template สำหรับทำ REST API ด้วย NestJS, Prisma, PostgreSQL, Redis, JWT auth และ response format มาตรฐาน

## Features

- NestJS 10 พร้อม TypeScript และ path alias `@/`
- Environment config + validation ด้วย `@nestjs/config` และ Joi
- PostgreSQL ผ่าน Prisma ORM
- Redis service ด้วย `ioredis` พร้อม fallback mode เมื่อ Redis ไม่จำเป็น
- JWT authentication ด้วย Passport JWT
- Global validation pipe, exception filter, response interceptor และ HTTP logger
- Swagger API docs ที่ `/docs` ใน non-production
- Users domain ตัวอย่างแบบ CRUD พร้อม repository pattern และ soft delete
- Health endpoint
- Dockerfile และ `docker-compose.yml` สำหรับ app, PostgreSQL และ Redis
- Unit test และ e2e test พื้นฐาน

## Requirements

- Node.js 20+
- pnpm
- Docker และ Docker Compose ถ้าต้องการรัน PostgreSQL/Redis ผ่าน container

บน Windows ถ้า PowerShell block `pnpm.ps1` ให้ใช้ `pnpm.cmd` แทน `pnpm` ได้ทุกคำสั่ง

## Quick Start

รัน database/cache ผ่าน Docker แล้วรัน NestJS บนเครื่อง:

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis
pnpm prisma:migrate
pnpm prisma:generate
pnpm seed
pnpm dev
```

หลังจากรันสำเร็จ:

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`
- Health check: `GET http://localhost:3000/api/v1/health`

Seed จะสร้าง admin user:

```text
email: admin@example.com
password: password123
```

## Environment Variables

คัดลอก `.env.example` เป็น `.env` แล้วปรับค่าให้ตรง environment ที่ใช้งาน

```env
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nest_starter?schema=public
JWT_SECRET=change-me
JWT_EXPIRES_IN=1d
CORS_ORIGINS=http://localhost:3000
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_REQUIRED=false
CACHE_TTL_SECONDS=300
ENABLE_SWAGGER=true
PRISMA_QUERY_LOG=false
```

ค่าที่จำเป็น:

- `DATABASE_URL`: connection string ของ PostgreSQL
- `JWT_SECRET`: secret สำหรับ sign JWT ต้องยาวอย่างน้อย 8 ตัวอักษร

## Scripts

```bash
pnpm dev              # start dev server with watch mode
pnpm build            # build production files into dist/
pnpm start            # run built app
pnpm lint             # run ESLint
pnpm format           # format codebase
pnpm test             # run unit tests
pnpm test:watch       # run unit tests in watch mode
pnpm test:cov         # run tests with coverage
pnpm test:e2e         # run e2e tests
pnpm prisma:generate  # generate Prisma client
pnpm prisma:migrate   # create/apply dev migration
pnpm prisma:deploy    # apply migrations in deployment
pnpm prisma:studio    # open Prisma Studio
pnpm seed             # seed initial admin user
pnpm docker:up        # start Docker services
pnpm docker:down      # stop Docker services
```

## Docker

รันทั้ง app, PostgreSQL และ Redis ด้วย Docker Compose:

```bash
cp .env.example .env
pnpm docker:up
```

ถ้าต้องการรัน migration/seed ใน container app:

```bash
docker compose exec app pnpm prisma:migrate
docker compose exec app pnpm seed
```

หยุด services:

```bash
pnpm docker:down
```

ถ้าต้องการรันเฉพาะ database/cache ผ่าน Docker แล้วรัน app บนเครื่อง:

```bash
docker compose up -d postgres redis
pnpm dev
```

## API Endpoints

ค่าเริ่มต้นของ global prefix คือ `/api/v1`

| Method   | Path          | Auth         | Description                    |
| -------- | ------------- | ------------ | ------------------------------ |
| `GET`    | `/health`     | Public       | ตรวจสถานะ service              |
| `POST`   | `/auth/login` | Public       | login และรับ access token      |
| `POST`   | `/users`      | Public       | สร้าง user                     |
| `GET`    | `/users`      | Bearer token | ดึงรายการ users แบบ pagination |
| `GET`    | `/users/:id`  | Bearer token | ดึง user ตาม UUID              |
| `PATCH`  | `/users/:id`  | Bearer token | แก้ไข user                     |
| `DELETE` | `/users/:id`  | Bearer token | soft delete user               |

ตัวอย่าง login:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

เรียก protected endpoint:

```bash
curl http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer <accessToken>"
```

## Standard Response

Controller ควร return ผ่าน `ApiResponse` เพื่อให้ response มีรูปแบบเดียวกัน

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {}
}
```

Paginated response:

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "perPage": 10,
    "lastPage": 1
  }
}
```

Error response จะถูกจัดรูปแบบโดย `GlobalExceptionFilter`:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": []
}
```

## Project Structure

```text
src/
  main.ts
  app.module.ts
  config/
  common/
    decorators/
    filters/
    guards/
    interceptors/
    middleware/
    pipes/
    responses/
  shared/
    dto/
    entities/
    interfaces/
    services/
    utils/
  domain/
    auth/
    health/
    users/
prisma/
  schema.prisma
  seed.ts
test/
  app.e2e-spec.ts
```

หลักการแยก responsibility:

- `common`: ของที่อยู่ใกล้ HTTP layer เช่น guard, decorator, pipe, interceptor, filter
- `shared`: services และ utilities ที่ใช้ซ้ำข้าม domain เช่น Prisma, Redis, pagination
- `domain`: feature modules ของระบบ เช่น `auth`, `health`, `users`
- `prisma`: database schema และ seed script
- `test`: e2e tests

## Architecture Pattern

Starter นี้ใช้ domain-oriented structure และ repository pattern

ในแต่ละ domain ควรแยกเป็น:

```text
domain-name/
  domain-name.module.ts
  presentation/
  service/
  infrastructure/
  dto/
  entity/
  types/
```

แนวทางหลัก:

- Controller รับ request, validate DTO และส่ง response เท่านั้น
- Service เก็บ business logic
- Repository ทำ data access
- Prisma อยู่ใน infrastructure layer
- Inject repository ผ่าน token เช่น `USER_REPOSITORY`
- ใช้ NestJS exceptions แล้วให้ `GlobalExceptionFilter` จัดรูปแบบ error
- ใช้ `ApiResponse` ใน controller
- ไม่ expose sensitive field เช่น `password`
- ใช้ soft delete ด้วย `deletedAt` และ query เฉพาะ record ที่ `deletedAt: null`

## Authentication

ทุก route ถูกป้องกันด้วย global `JwtAuthGuard` เป็นค่าเริ่มต้น ยกเว้น route ที่ใส่ `@Public()`

ตัวอย่าง public route:

```ts
@Public()
@Post('login')
login() {}
```

ตัวอย่าง protected route:

```ts
@Get('profile')
profile(@CurrentUser() user: JwtPayload) {
  return ApiResponse.item(user);
}
```

Client ต้องส่ง header:

```text
Authorization: Bearer <accessToken>
```

## Prisma

Schema ปัจจุบันมี `User` model:

- `id`: UUID
- `email`: unique
- `name`: optional
- `password`: optional hashed password
- `role`: `USER` หรือ `ADMIN`
- `createdAt`, `updatedAt`
- `deletedAt`: ใช้สำหรับ soft delete

คำสั่งที่ใช้บ่อย:

```bash
pnpm prisma:migrate
pnpm prisma:generate
pnpm prisma:studio
pnpm seed
```

## Redis

`RedisService` มี helper สำหรับ cache:

- `get<T>(key)`
- `set<T>(key, value, ttl?)`
- `del(key)`
- `deleteByPattern(pattern)`
- `getOrSet<T>(key, fetcher, ttl?)`
- `generateKey(parts, params?)`

ถ้า `REDIS_REQUIRED=false` แล้ว Redis ใช้งานไม่ได้ app จะ log warning และ start ต่อได้ ถ้า `REDIS_REQUIRED=true` app จะ fail startup

## Adding a New Domain

Checklist เมื่อต้องเพิ่ม domain ใหม่:

- เพิ่มหรือแก้ Prisma model
- รัน `pnpm prisma:migrate` และ `pnpm prisma:generate`
- สร้าง DTO สำหรับ body/query/param
- สร้าง entity หรือ response DTO ที่ไม่ expose sensitive data
- สร้าง repository interface และ repository token ด้วย `Symbol`
- สร้าง Prisma repository implementation
- สร้าง service สำหรับ business logic
- สร้าง controller และ return ผ่าน `ApiResponse`
- เพิ่ม provider mapping ใน module
- import module เข้า `AppModule`
- เพิ่ม unit test และ e2e test สำหรับ flow สำคัญ
- รัน `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:e2e`

## Verification

ก่อนเปิด PR หรือ deploy แนะนำให้รัน:

```bash
pnpm lint
pnpm build
pnpm test
pnpm test:e2e
```

ถ้ายังไม่ได้ generate Prisma client:

```bash
pnpm prisma:generate
```

## License

MIT

# NestJS Starter Guide

เอกสารนี้อธิบายว่า starter นี้มีส่วนประกอบอะไรบ้าง แต่ละไฟล์ทำหน้าที่อะไร และถ้าต้องเพิ่ม feature/domain ใหม่ควร implement ตาม pattern ไหน

## ภาพรวม

Starter นี้ออกแบบสำหรับ API backend ที่ต้องการโครงสร้างพร้อมใช้งานจริง แต่ยังไม่ผูกกับ business domain เฉพาะ เช่น CMS, multisite, article, gallery หรือ setup wizard

สิ่งที่มีให้:

- Bootstrap NestJS พร้อม global prefix, Helmet, CORS, validation, exception filter, response interceptor และ Swagger
- Environment config พร้อม validation ด้วย Joi
- Prisma สำหรับ PostgreSQL
- Redis cache service ด้วย ioredis
- JWT auth ด้วย Passport JWT
- Standard API response format
- Health endpoint
- Users domain ตัวอย่างแบบ CRUD, repository pattern และ soft delete
- Dockerfile และ docker-compose สำหรับ app, PostgreSQL, Redis
- Unit test และ e2e test ขั้นต่ำ

## โครงสร้างโปรเจกต์

```text
src/
  main.ts
  app.module.ts
  config/
  common/
  shared/
  domain/
prisma/
test/
```

หลักคิดของโครงสร้าง:

- `src/common` คือของที่อยู่ใกล้ HTTP layer เช่น interceptor, filter, guard, decorator, middleware, pipe
- `src/shared` คือของใช้ซ้ำที่ไม่ผูกกับ HTTP endpoint ใด endpoint หนึ่ง เช่น Prisma, Redis, pagination utility
- `src/domain` คือ feature/domain ของระบบ เช่น `health`, `auth`, `users`
- `prisma` คือ schema และ seed
- `test` คือ e2e test

## Application Bootstrap

ไฟล์หลักคือ `src/main.ts`

หน้าที่:

- สร้าง Nest app ด้วย `NestFactory.create(AppModule)`
- เปิด `helmet()` เพื่อเพิ่ม security headers
- เปิด CORS จาก env `CORS_ORIGINS`
- ตั้ง global prefix จาก env `API_PREFIX`
- เปิด global `ValidationPipe`
- เปิด `GlobalExceptionFilter`
- เปิด `ResponseInterceptor`
- เปิด Swagger ที่ `/docs` เฉพาะ non-production และ `ENABLE_SWAGGER=true`
- เปิด graceful shutdown ด้วย `app.enableShutdownHooks()`

ValidationPipe ที่ใช้:

```ts
new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
});
```

ผลลัพธ์:

- DTO query/body/param ถูกแปลง type อัตโนมัติ
- field ที่ไม่ได้ประกาศใน DTO จะถูกปฏิเสธ
- validation error จะถูกส่งต่อให้ global exception filter จัดรูปแบบ

## AppModule

ไฟล์ `src/app.module.ts` คือจุดรวม module หลัก

ประกอบด้วย:

- `ConfigModule.forRoot(...)`
- `PrismaModule`
- `RedisModule`
- `HealthModule`
- `UsersModule`
- `AuthModule`
- global `JwtAuthGuard`
- `HttpLoggerMiddleware`

สิ่งสำคัญ:

- Guard ถูกตั้งเป็น global ผ่าน `APP_GUARD`
- Route ที่ไม่ต้อง login ต้องใส่ `@Public()`
- Controller ไม่ควรเรียก Prisma หรือ Redis ตรง ๆ
- Business logic ควรอยู่ใน service

## Config

ไฟล์ใน `src/config`

### `app.config.ts`

อ่าน config ทั่วไป:

- `NODE_ENV`
- `PORT`
- `API_PREFIX`
- `CORS_ORIGINS`
- `ENABLE_SWAGGER`

ใช้งานผ่าน:

```ts
this.configService.get<string>('app.env');
this.configService.get<number>('app.port');
```

### `database.config.ts`

อ่าน config ฐานข้อมูล:

- `DATABASE_URL`
- `PRISMA_QUERY_LOG`

### `redis.config.ts`

อ่าน config Redis:

- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `REDIS_DB`
- `REDIS_REQUIRED`
- `CACHE_TTL_SECONDS`

### `validation.ts`

ใช้ Joi validate env ก่อน app start

ถ้าค่า required เช่น `DATABASE_URL` หรือ `JWT_SECRET` ไม่มี app จะ start ไม่ผ่าน

## Standard API Response

ไฟล์ `src/common/responses/api-response.ts`

ทุก controller ควร return ผ่าน `ApiResponse`

### Methods

```ts
ApiResponse.success(data, message?)
ApiResponse.created(data, message?)
ApiResponse.updated(data, message?)
ApiResponse.deleted(message?)
ApiResponse.item(data, message?)
ApiResponse.collection(data, meta?, message?)
ApiResponse.paginated(items, pagination, message?)
ApiResponse.badRequest(message, errors?)
ApiResponse.unauthorized(message?)
ApiResponse.forbidden(message?)
ApiResponse.notFound(message?)
ApiResponse.internalServerError(message?)
```

ตัวอย่าง item:

```ts
return ApiResponse.item(user);
```

Response:

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {}
}
```

ตัวอย่าง paginated:

```ts
const result = await this.usersService.findMany(query);
return ApiResponse.paginated(result.items, result.meta);
```

Response:

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

## ResponseInterceptor

ไฟล์ `src/common/interceptors/response.interceptor.ts`

หน้าที่:

- ถ้า controller return object ที่เป็น `ApiResponsePayload` อยู่แล้ว จะส่งต่อและตั้ง HTTP status ตาม `statusCode`
- ถ้า controller return data ปกติ จะ wrap เป็นรูปแบบมาตรฐานให้อัตโนมัติ

คำแนะนำ:

- ใน controller ให้ใช้ `ApiResponse` ชัดเจนเพื่อควบคุม message/status ได้ง่าย
- อย่า format response เองซ้ำในแต่ละ controller

## GlobalExceptionFilter

ไฟล์ `src/common/filters/global-exception.filter.ts`

หน้าที่:

- จัดรูปแบบ error ทุกตัวให้อยู่ใน format เดียวกัน
- รองรับ `HttpException`
- รองรับ validation error จาก class-validator
- ซ่อน internal error detail ใน production
- log unexpected error ด้วย NestJS `Logger`

ตัวอย่าง error:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": []
}
```

การใช้งาน:

- ใน service ให้ throw Nest exception เช่น `NotFoundException`, `ConflictException`, `UnauthorizedException`
- ไม่ต้อง try/catch เพื่อแปลง error ในทุก endpoint

## HTTP Logger Middleware

ไฟล์ `src/common/middleware/http-logger.middleware.ts`

หน้าที่:

- log method, path, status code และ response time หลัง request จบ

ตัวอย่าง log:

```text
GET /api/v1/health 200 12ms
```

## Decorators

### `@Public()`

ไฟล์ `src/common/decorators/public.decorator.ts`

ใช้กับ route หรือ controller ที่ไม่ต้องใช้ JWT

```ts
@Public()
@Get('health')
check() {}
```

### `@CurrentUser()`

ไฟล์ `src/common/decorators/current-user.decorator.ts`

ใช้ดึง user จาก JWT payload

```ts
@Get('me')
getMe(@CurrentUser() user: JwtPayload) {
  return user;
}
```

หรือดึง field เดียว:

```ts
@CurrentUser('sub') userId: string
```

## JWT Auth

ไฟล์หลัก:

- `src/domain/auth/auth.module.ts`
- `src/domain/auth/presentation/auth.controller.ts`
- `src/domain/auth/service/auth.service.ts`
- `src/domain/auth/service/jwt.strategy.ts`
- `src/common/guards/jwt-auth.guard.ts`

### Login flow

1. Client เรียก `POST /api/v1/auth/login`
2. `AuthController` รับ `LoginDto`
3. `AuthService` หา user ด้วย `UsersService.findByEmail`
4. ตรวจ password ด้วย bcrypt
5. สร้าง JWT payload
6. คืน `accessToken`

Payload:

```ts
{
  sub: user.id,
  email: user.email,
  role: user.role,
}
```

### การป้องกัน route

โดย default ทุก route ถูกป้องกันด้วย global `JwtAuthGuard`

ถ้าต้องการ public:

```ts
@Public()
@Post('login')
login() {}
```

ถ้าต้องการ protected route ไม่ต้องใส่อะไรเพิ่ม

```ts
@Get('profile')
profile(@CurrentUser() user: JwtPayload) {
  return ApiResponse.item(user);
}
```

## Prisma

ไฟล์หลัก:

- `src/shared/services/prisma/prisma.module.ts`
- `src/shared/services/prisma/prisma.service.ts`
- `prisma/schema.prisma`
- `prisma/seed.ts`

### PrismaService

`PrismaService` extends `PrismaClient`

หน้าที่:

- connect database ตอน `onModuleInit`
- disconnect ตอน `onModuleDestroy`
- เปิด query log เมื่อ `PRISMA_QUERY_LOG=true`

ข้อกำหนด:

- Prisma ควรถูกใช้ใน infrastructure layer เท่านั้น
- Controller และ service ไม่ควร import `PrismaService` ตรง ๆ
- Service ควรเรียก repository interface

### Schema

model `User` มี field:

- `id` เป็น uuid
- `email` unique
- `name` nullable
- `password` nullable
- `role` enum `USER` หรือ `ADMIN`
- `createdAt`
- `updatedAt`
- `deletedAt` สำหรับ soft delete

Soft delete convention:

- query ปกติควร filter `deletedAt: null`
- delete ควร update `deletedAt` แทนการลบ record

## Redis Cache

ไฟล์หลัก:

- `src/shared/services/redis/redis.module.ts`
- `src/shared/services/redis/redis.service.ts`

### Methods

```ts
get<T>(key): Promise<T | null>
set<T>(key, value, ttl?): Promise<void>
del(key): Promise<void>
deleteByPattern(pattern): Promise<number>
getOrSet<T>(key, fetcher, ttl?): Promise<T>
generateKey(parts, params?): string
```

### ตัวอย่างใช้งานใน service

```ts
const key = this.redisService.generateKey(['users', 'list'], query);

return this.redisService.getOrSet(
  key,
  () => this.userRepository.findMany(query),
  300,
);
```

### ข้อควรระวัง

- ใช้ `deleteByPattern` ที่ทำงานด้วย `scan`
- ห้ามใช้ Redis `keys('*')` ใน production
- ถ้า `REDIS_REQUIRED=false` และ Redis ใช้ไม่ได้ app จะ log warning แล้ว start ต่อ
- ถ้า `REDIS_REQUIRED=true` และ Redis ใช้ไม่ได้ app จะ fail startup

## Shared Utilities

### Pagination

ไฟล์:

- `src/shared/dto/pagination-query.dto.ts`
- `src/shared/utils/pagination.util.ts`

`PaginationQueryDto` รองรับ:

- `page`
- `perPage`
- `search`
- `orderBy`
- `sortBy`
- `orderDirection`
- `populate`

ใช้สร้าง meta:

```ts
const meta = buildPaginationMeta(total, page, perPage);
```

ใช้คำนวณ skip:

```ts
const skip = getPaginationSkip(page, perPage);
```

### Query utility

ไฟล์ `src/shared/utils/query.util.ts`

ใช้สร้าง order by แบบ whitelist:

```ts
const orderBy = buildOrderBy(
  query.orderBy,
  query.orderDirection,
  ['name', 'createdAt'],
  { createdAt: 'desc' },
);
```

### Populate parser

ไฟล์ `src/shared/utils/parse-populate.util.ts`

ใช้ whitelist field ที่อนุญาตให้ populate:

```ts
const populate = parsePopulate(query.populate, ['profile', 'roles']);
```

### Cache key

ไฟล์ `src/shared/utils/generate-cache-key.util.ts`

```ts
const key = generateCacheKey(['users', 'detail', id]);
```

หรือ:

```ts
const key = generateCacheKey(['users', 'list'], {
  page: 1,
  perPage: 10,
});
```

### Slug

ไฟล์ `src/shared/utils/slug.util.ts`

รองรับภาษาอังกฤษและไทย

```ts
const slug = await generateSlug(title, {
  maxLength: 80,
  checkExists: (candidate) => repository.slugExists(candidate),
});
```

ถ้า slug ซ้ำ จะเติม suffix เช่น `title-1`, `title-2`

### Transformer

ไฟล์ `src/shared/utils/transformer.util.ts`

```ts
toBoolean(value)
toNumber(value, fallback)
```

### Object utility

ไฟล์ `src/shared/utils/object.util.ts`

```ts
omitUndefined(value)
omitKeys(value, ['password'])
```

## Users Domain

Users เป็น domain ตัวอย่างสำหรับ pattern การเพิ่ม feature ใหม่

โครงสร้าง:

```text
src/domain/users/
  users.module.ts
  presentation/users.controller.ts
  service/users.service.ts
  infrastructure/user.repository.ts
  infrastructure/user.prisma.repository.ts
  infrastructure/user.repository-token.ts
  entity/user.entity.ts
  dto/create-user.dto.ts
  dto/update-user.dto.ts
  dto/user-response.dto.ts
  dto/user-query.dto.ts
  types/user.type.ts
```

### Controller

ไฟล์ `users.controller.ts`

หน้าที่:

- รับ request
- ใช้ DTO กับ body/query/param
- เรียก service
- return ด้วย `ApiResponse`

Endpoints:

- `POST /users`
- `GET /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `DELETE /users/:id`

ตัวอย่าง:

```ts
@Get(':id')
async findById(@Param('id', ParseUuidPipe) id: string) {
  const user = await this.usersService.findById(id);
  return ApiResponse.item(user);
}
```

### Service

ไฟล์ `users.service.ts`

หน้าที่:

- เก็บ business logic
- ตรวจ duplicate email
- hash password
- throw exception เมื่อหา user ไม่เจอ
- แปลง entity เป็น response DTO ที่ไม่ expose password
- เรียก repository interface เท่านั้น

ตัวอย่าง dependency:

```ts
constructor(
  @Inject(USER_REPOSITORY)
  private readonly userRepository: UserRepository,
) {}
```

### Repository Interface

ไฟล์ `user.repository.ts`

กำหนด contract ที่ service ต้องการ:

```ts
export interface UserRepository {
  create(data: CreateUserDto): Promise<UserEntity>;
  findMany(query: UserQueryDto): Promise<PaginatedResult<UserEntity>>;
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  update(id: string, data: UpdateUserDto): Promise<UserEntity>;
  softDelete(id: string): Promise<void>;
}
```

### Repository Token

ไฟล์ `user.repository-token.ts`

ใช้ `Symbol` แทน string literal:

```ts
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
```

### Prisma Repository

ไฟล์ `user.prisma.repository.ts`

หน้าที่:

- ใช้ `PrismaService`
- query database
- filter `deletedAt: null`
- implement soft delete
- map Prisma model เป็น entity

### Module

ไฟล์ `users.module.ts`

ผูก interface token กับ implementation:

```ts
{
  provide: USER_REPOSITORY,
  useClass: UserPrismaRepository,
}
```

## Health Domain

ไฟล์หลัก:

- `src/domain/health/health.module.ts`
- `src/domain/health/presentation/health.controller.ts`
- `src/domain/health/service/health.service.ts`

Endpoint:

```text
GET /api/v1/health
```

Response:

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "status": "ok",
    "env": "development",
    "uptime": 10,
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

## วิธีเพิ่ม Domain ใหม่

ตัวอย่างเพิ่ม domain `products`

### 1. เพิ่ม Prisma model

แก้ `prisma/schema.prisma`

```prisma
model Product {
  id          String    @id @default(uuid()) @db.Uuid
  name        String
  slug        String    @unique
  description String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  @@index([deletedAt])
}
```

จากนั้นรัน:

```bash
pnpm prisma:migrate
pnpm prisma:generate
```

### 2. สร้าง folder domain

```text
src/domain/products/
  products.module.ts
  presentation/products.controller.ts
  service/products.service.ts
  infrastructure/product.repository.ts
  infrastructure/product.prisma.repository.ts
  infrastructure/product.repository-token.ts
  entity/product.entity.ts
  dto/create-product.dto.ts
  dto/update-product.dto.ts
  dto/product-response.dto.ts
  dto/product-query.dto.ts
  types/product.type.ts
```

### 3. สร้าง entity

```ts
export class ProductEntity extends BaseEntity {
  name: string;
  slug: string;
  description: string | null;
}
```

### 4. สร้าง DTO

```ts
export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

```ts
export class UpdateProductDto extends PartialType(CreateProductDto) {}
```

```ts
export class ProductQueryDto extends PaginationQueryDto {}
```

### 5. สร้าง repository interface

```ts
export interface ProductRepository {
  create(data: CreateProductDto & { slug: string }): Promise<ProductEntity>;
  findMany(query: ProductQueryDto): Promise<PaginatedResult<ProductEntity>>;
  findById(id: string): Promise<ProductEntity | null>;
  findBySlug(slug: string): Promise<ProductEntity | null>;
  update(id: string, data: UpdateProductDto): Promise<ProductEntity>;
  softDelete(id: string): Promise<void>;
}
```

### 6. สร้าง repository token

```ts
export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
```

### 7. สร้าง Prisma repository

หลักที่ต้องทำ:

- inject `PrismaService`
- implement ทุก method ใน interface
- query เฉพาะ record ที่ `deletedAt: null`
- ใช้ `buildPaginationMeta`, `getPaginationSkip`, `buildOrderBy`
- map Prisma model เป็น entity

### 8. สร้าง service

หลักที่ต้องทำ:

- inject repository ผ่าน token
- เขียน business logic เช่น generate slug, validate uniqueness
- throw exception เช่น `NotFoundException`, `ConflictException`
- return response DTO
- ไม่เรียก Prisma ตรง ๆ

ตัวอย่าง:

```ts
const slug = await generateSlug(dto.name, {
  checkExists: async (candidate) => Boolean(await this.productRepository.findBySlug(candidate)),
});
```

### 9. สร้าง controller

หลักที่ต้องทำ:

- ใช้ DTO ทุก request body/query/param
- ใช้ `ParseUuidPipe` กับ id
- return ผ่าน `ApiResponse`
- ไม่เขียน business logic ใน controller

### 10. Register module

เพิ่ม `ProductsModule` เข้า `imports` ใน `src/app.module.ts`

```ts
imports: [
  ProductsModule,
]
```

## วิธีเพิ่ม Protected Endpoint

ไม่ต้องใส่ guard เพิ่ม เพราะ app ใช้ global `JwtAuthGuard`

```ts
@Get('me')
getMe(@CurrentUser() user: JwtPayload) {
  return ApiResponse.item(user);
}
```

Client ต้องส่ง:

```text
Authorization: Bearer <accessToken>
```

## วิธีเพิ่ม Public Endpoint

ใส่ `@Public()`

```ts
@Public()
@Get('status')
status() {
  return ApiResponse.item({ status: 'ok' });
}
```

## วิธีใช้ Cache ใน Domain

Inject `RedisService` ใน service

```ts
constructor(
  @Inject(PRODUCT_REPOSITORY)
  private readonly productRepository: ProductRepository,
  private readonly redisService: RedisService,
) {}
```

ใช้ `getOrSet`

```ts
const key = this.redisService.generateKey(['products', 'list'], query);

return this.redisService.getOrSet(
  key,
  () => this.productRepository.findMany(query),
  300,
);
```

Invalidate หลัง create/update/delete:

```ts
await this.redisService.deleteByPattern('products:*');
```

## วิธีเขียน Test

### Unit test service

แนวทาง:

- mock repository interface
- test business rules
- test exception
- test ว่า response ไม่ expose field sensitive

ตัวอย่างจาก `users.service.spec.ts`:

- create user สำเร็จ
- duplicate email ต้อง throw `ConflictException`
- find by id สำเร็จ
- find by id ไม่เจอต้อง throw `NotFoundException`

### E2E test

ไฟล์ `test/app.e2e-spec.ts`

แนวทาง:

- สร้าง testing module จาก `AppModule`
- override provider ที่ต้องใช้ external service เช่น Prisma และ Redis
- ยิง request ด้วย Supertest
- assert response format

## Docker

### Dockerfile

มี 4 stage:

- `base` เตรียม Node 20 alpine และ pnpm
- `development` สำหรับ dev server
- `builder` install dependency, generate Prisma, build app
- `release` copy เฉพาะของจำเป็นและ run ด้วย non-root user

### docker-compose

Services:

- `app`
- `postgres`
- `redis`

Run:

```bash
cp .env.example .env
pnpm docker:up
```

Stop:

```bash
pnpm docker:down
```

## Checklist เวลา Implement Feature ใหม่

ใช้ checklist นี้ทุกครั้งที่เพิ่ม domain ใหม่:

- เพิ่มหรือแก้ Prisma model
- รัน migration และ generate client
- สร้าง DTO สำหรับ body/query/param
- สร้าง entity
- สร้าง repository interface
- สร้าง repository token ด้วย `Symbol`
- สร้าง Prisma repository implementation
- สร้าง service และใส่ business logic
- สร้าง controller และ return ผ่าน `ApiResponse`
- ใส่ module provider mapping
- import module เข้า `AppModule`
- เพิ่ม unit test สำหรับ service
- เพิ่ม e2e test สำหรับ endpoint สำคัญ
- ตรวจว่าไม่มี password หรือ sensitive field หลุดใน response
- ตรวจว่า soft delete query filter `deletedAt: null`
- รัน `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:e2e`

## Coding Rules

- Controller รับ request และส่ง response เท่านั้น
- Service ทำ business logic
- Repository ทำ data access
- Prisma อยู่ใน infrastructure layer เท่านั้น
- ใช้ DTO validation ทุก body/query/param
- ใช้ `ApiResponse` ทุก endpoint
- ใช้ NestJS exception และปล่อยให้ `GlobalExceptionFilter` format error
- ใช้ `Logger` แทน `console.log`
- ใช้ repository token constant แทน string literal
- หลีกเลี่ยง `any`
- ห้าม expose password
- ห้ามใช้ Redis `keys('*')` ใน production
- ห้ามใส่ business domain เฉพาะที่ไม่ใช่ starter scope

## Verification Commands

หลัง implement หรือแก้ไข starter ควรรัน:

```bash
pnpm install
pnpm prisma:generate
pnpm lint
pnpm build
pnpm test
pnpm test:e2e
```

บน Windows ถ้า PowerShell block `pnpm.ps1` ให้ใช้:

```bash
pnpm.cmd install
pnpm.cmd prisma:generate
pnpm.cmd lint
pnpm.cmd build
pnpm.cmd test
pnpm.cmd test:e2e
```

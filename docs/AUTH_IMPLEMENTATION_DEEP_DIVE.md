# Auth Implementation Deep Dive

เอกสารนี้อธิบายสิ่งที่เพิ่มเข้ามาสำหรับ backend NestJS ที่รองรับ Next.js frontend/BFF, JWT access token, Bearer token, และ httpOnly cookie

เป้าหมายของ implementation นี้คือให้ backend รองรับ 2 วิธีพร้อมกัน:

```txt
Next frontend/BFF -> ส่ง Authorization: Bearer <token>
Postman/browser direct -> ใช้ Authorization: Bearer <token> หรือ cookie auth_token=<token>
```

## ภาพรวมการออกแบบ

### ทำไมมีทั้ง Bearer token และ httpOnly cookie

Bearer token เหมาะกับ flow ที่ Next API ทำตัวเป็น BFF เพราะ Next API สามารถอ่าน token จาก cookie ฝั่ง server แล้ว forward ไป backend ด้วย header:

```http
Authorization: Bearer <token>
```

httpOnly cookie เหมาะกับ browser/Postman direct test เพราะ browser สามารถแนบ cookie ไปกับ request ได้เอง โดย JavaScript ฝั่ง browser อ่าน cookie นี้ไม่ได้ ทำให้ลดความเสี่ยงจาก XSS ที่ขโมย token ผ่าน `document.cookie`

backend จึงอ่าน token จาก 2 ที่ตามลำดับ:

1. `Authorization: Bearer <token>`
2. `auth_token=<token>` cookie

### ทำไมใช้ JWT access token

JWT ทำให้ backend ตรวจ identity ได้จาก token โดยไม่ต้อง query database ทุก request ใน demo นี้ payload มี:

```ts
{
  sub: user.id,
  email: user.email,
  role: user.role,
  jti,
}
```

ความหมาย:

- `sub` คือ subject หรือ user id ของเจ้าของ token
- `email` ใช้ระบุตัว user เพิ่มเติม
- `role` ใช้ต่อยอด authorization เช่น USER/ADMIN
- `jti` คือ JWT ID ใช้แยก token แต่ละใบ ทำให้ logout/revoke token ใบใดใบหนึ่งได้

### ทำไมต้องมี active session store

JWT แบบ stateless โดยตัวมันเอง logout ทันทีไม่ได้ เพราะเมื่อ token ถูกออกไปแล้ว backend ที่ตรวจเฉพาะ signature กับ expiry จะยังยอมรับ token เดิมจนกว่าจะหมดอายุ

ใน demo นี้จึงมี:

```ts
private readonly activeSessionIds = new Set<string>();
```

ทุกครั้งที่ register/login จะ generate `jti` ใหม่และเก็บไว้ใน `activeSessionIds`

ตอน protected route จะตรวจว่า `jti` ยังอยู่ใน store หรือไม่

ตอน logout จะลบ `jti` ออกจาก store ทำให้ token เดิมถูก reject ทันทีด้วย `401 Unauthorized`

ข้อจำกัด: store นี้อยู่ใน memory ถ้า restart server ข้อมูล session จะหายทั้งหมด ใน production ควรเปลี่ยนเป็น Redis, database table, หรือ session/token store ที่ persist ได้

### ทำไมใช้ `JwtAuthGuard` เป็นหลัก

NestJS มีหลายจุดที่ใช้ validate request ได้ เช่น middleware, guard, interceptor

implementation นี้ใช้ `JwtAuthGuard` เพราะ:

- guard เป็น layer ที่เหมาะกับ authorization โดยตรง
- guard เห็น metadata ของ route เช่น `@Public()`
- ใช้เป็น global guard ได้ ทำให้ route ใหม่ protected เป็น default
- public route ต้องระบุชัดเจนด้วย `@Public()`

ยังมี `ValidateJwtMiddleware` ให้ไว้ตาม requirement และใช้ logic เดียวกับ guard ถ้าต้องการเปลี่ยนไป apply middleware กับ route group ในอนาคต

### ทำไมต้องมี `@RawResponse()`

starter เดิมมี `ResponseInterceptor` ที่ห่อ response เป็นรูปแบบ:

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {}
}
```

แต่ contract ที่ต้องการคือคืน JSON ตรง ๆ เช่น:

```json
{
  "accessToken": "jwt-token",
  "user": {}
}
```

และ:

```json
[
  {
    "imagePath": "/thumb-react.svg"
  }
]
```

จึงเพิ่ม `@RawResponse()` เพื่อบอก interceptor ว่า controller นี้ต้องคืน response ตรงตาม contract โดยไม่ถูก wrap เพิ่ม

## Request Flow

### Register

```txt
POST /auth/register
  -> ValidationPipe ตรวจ RegisterDto
  -> AuthController.register()
  -> AuthService.register()
  -> UsersService.create()
  -> bcrypt.hash(password)
  -> generate user id
  -> generate jwt jti
  -> sign JWT
  -> store jti in activeSessionIds
  -> set httpOnly cookie auth_token
  -> return { accessToken, user }
```

### Login

```txt
POST /auth/login
  -> ValidationPipe ตรวจ LoginDto
  -> AuthController.login()
  -> AuthService.login()
  -> UsersService.findByEmail()
  -> bcrypt.compare(password, passwordHash)
  -> generate jwt jti
  -> sign JWT
  -> store jti in activeSessionIds
  -> set httpOnly cookie auth_token
  -> return { accessToken, user }
```

### Protected Route

```txt
GET /databaseImg
  -> JwtAuthGuard.canActivate()
  -> ถ้า route ไม่ใช่ @Public()
  -> อ่าน token จาก Authorization header ก่อน
  -> ถ้าไม่มี header อ่านจาก cookie auth_token
  -> verify JWT signature/expiry
  -> ตรวจว่า jti ยังอยู่ใน activeSessionIds
  -> attach payload เข้า request.user
  -> DatabaseImgController.findAll()
  -> return array ตรงตาม contract
```

### Logout

```txt
POST /auth/logout
  -> JwtAuthGuard.canActivate()
  -> validate token จาก Bearer หรือ cookie
  -> request.user มี payload ที่ผ่าน validate แล้ว
  -> AuthController.logout()
  -> AuthService.logout(request.user.jti)
  -> remove jti from activeSessionIds
  -> clear cookie auth_token
  -> return { "message": "Logged out" }
```

## รายละเอียดไฟล์

## `src/auth/auth.controller.ts`

ไฟล์นี้รับ HTTP request ของ auth ทั้งหมด และแปลง request/response ให้อยู่ใน contract ที่ frontend ต้องการ

```ts
import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
```

นำเข้า decorator และ type จาก NestJS:

- `Body` ใช้อ่าน request body แล้ว bind เข้า DTO
- `Controller` ใช้ประกาศว่า class นี้เป็น controller
- `HttpCode` ใช้กำหนด status code เอง
- `Post` ใช้ประกาศ POST route
- `Req` ใช้อ่าน request object
- `Res` ใช้เข้าถึง response object เพื่อ set/clear cookie

```ts
import { ConfigService } from '@nestjs/config';
```

นำเข้า `ConfigService` เพื่ออ่านค่า config เช่น `app.env` สำหรับตัดสินใจว่า cookie ต้อง `secure` หรือไม่

```ts
import { Response } from 'express';
```

นำ type `Response` จาก Express มาใช้กับ `@Res()` เพื่อให้ TypeScript รู้ว่า object นี้มี method `cookie()` และ `clearCookie()`

```ts
import { AuthService } from '@/auth/auth.service';
```

นำ service ที่มี business logic ของ auth เข้ามาใช้ controller ไม่ hash password หรือ sign JWT เอง เพื่อแยกหน้าที่ให้ชัด

```ts
import { LoginDto } from '@/auth/dto/login.dto';
```

นำ DTO สำหรับ validate body ของ login

```ts
import { RegisterDto } from '@/auth/dto/register.dto';
```

นำ DTO สำหรับ validate body ของ register

```ts
import { AuthenticatedRequest, AuthResponse } from '@/auth/types';
```

นำ type กลางของ auth:

- `AuthenticatedRequest` คือ Express request ที่มี `user` หลังผ่าน guard
- `AuthResponse` คือ response contract ของ register/login

```ts
import { Public } from '@/common/decorators/public.decorator';
```

นำ decorator `@Public()` มาใช้บอก global auth guard ว่า route นี้ไม่ต้อง login

```ts
import { RawResponse } from '@/common/decorators/raw-response.decorator';
```

นำ decorator `@RawResponse()` มาใช้เพื่อข้าม response wrapper ของ starter

```ts
@Controller('auth')
```

กำหนด base path ของ controller เป็น `/auth`

ทุก route ใน class นี้จึงขึ้นต้นด้วย `/auth`

```ts
@RawResponse()
```

บอก `ResponseInterceptor` ว่า response จาก controller นี้ต้องคืนตรง ๆ ไม่ต้องห่อด้วย `{ statusCode, message, data }`

เหตุผลคือ prompt ระบุ contract ของ auth response เป็น JSON ตรง ๆ

```ts
export class AuthController {
```

ประกาศ class controller และ export เพื่อให้ `AuthModule` นำไป register ได้

```ts
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}
```

ใช้ dependency injection ของ NestJS:

- `authService` สำหรับ register/login/logout
- `configService` สำหรับอ่าน environment ผ่าน config namespace
- `private readonly` ทำให้ property ถูกสร้างจาก constructor parameter และแก้ reference ไม่ได้หลัง construct

```ts
  @Public()
```

กำหนดว่า endpoint ถัดไปเป็น public route ไม่ต้องมี JWT

```ts
  @Post('register')
```

ประกาศ route `POST /auth/register`

```ts
  @HttpCode(200)
```

ตั้ง status code เป็น 200 แทน default ของ NestJS สำหรับ POST ที่มักเป็น 201

ใช้ 200 เพื่อให้ register/login มี contract ใกล้กันและเรียบง่ายสำหรับ frontend

```ts
  async register(
```

ประกาศ method `register` เป็น async เพราะต้อง await การสร้าง user, hash password, และ sign JWT

```ts
    @Body() dto: RegisterDto,
```

อ่าน request body แล้ว validate/transform ด้วย `RegisterDto` ผ่าน global `ValidationPipe`

```ts
    @Res({ passthrough: true }) response: Response,
```

รับ Express response object เพื่อ set cookie

`passthrough: true` สำคัญมาก เพราะทำให้ยัง return object จาก method ได้ตามปกติ ไม่ต้องเรียก `response.json()` เอง

```ts
  ): Promise<AuthResponse> {
```

ระบุว่า method นี้คืน promise ของ auth response contract:

```json
{
  "accessToken": "...",
  "user": {}
}
```

```ts
    const result = await this.authService.register(dto);
```

ส่ง DTO ไปให้ service สร้าง user และ token

controller ไม่จัดการ hash/sign เอง เพื่อให้ controller มีหน้าที่แค่รับ HTTP และส่ง response

```ts
    this.setAuthCookie(response, result.accessToken);
```

นำ access token ที่ service สร้างไป set เป็น httpOnly cookie ชื่อ `auth_token`

```ts
    return result;
```

คืน response body ตรงตาม contract

```ts
  }
```

จบ method register

```ts
  @Public()
```

login เป็น public เช่นกัน เพราะ user ยังไม่มี token ก่อน login

```ts
  @Post('login')
```

ประกาศ route `POST /auth/login`

```ts
  @HttpCode(200)
```

บังคับ status code 200 เพื่อให้ response ชัดเจนและตรงกับ flow ทั่วไปของ login

```ts
  async login(
```

ประกาศ method login เป็น async เพราะต้อง compare password และ sign token

```ts
    @Body() dto: LoginDto,
```

อ่าน body ของ login เช่น email/password แล้ว validate ด้วย `LoginDto`

```ts
    @Res({ passthrough: true }) response: Response,
```

รับ response object เพื่อ set cookie โดยยัง return JSON จาก method ได้

```ts
  ): Promise<AuthResponse> {
```

ระบุ response type ว่าเหมือน register

```ts
    const result = await this.authService.login(dto);
```

ให้ service ตรวจ user/password และสร้าง token

```ts
    this.setAuthCookie(response, result.accessToken);
```

set cookie `auth_token` หลัง login สำเร็จ

```ts
    return result;
```

คืน `{ accessToken, user }` ให้ frontend หรือ Postman เอา token ไปใช้เป็น Bearer ได้

```ts
  }
```

จบ method login

```ts
  @Post('logout')
```

ประกาศ route `POST /auth/logout`

ไม่มี `@Public()` ดังนั้น global `JwtAuthGuard` จะบังคับให้ต้องมี token

```ts
  @HttpCode(200)
```

logout สำเร็จคืน 200

```ts
  logout(
```

ประกาศ method logout ไม่ต้องเป็น async เพราะการลบ `jti` จาก in-memory set เป็น sync operation

```ts
    @Req() request: AuthenticatedRequest,
```

อ่าน request ที่ผ่าน guard แล้ว ซึ่งควรมี `request.user` เป็น JWT payload

```ts
    @Res({ passthrough: true }) response: Response,
```

รับ response object เพื่อ clear cookie

```ts
  ): { message: string } {
```

ระบุ response body ของ logout เป็น object ที่มี `message`

```ts
    if (request.user?.jti) {
```

ตรวจว่า guard attach payload และ payload มี `jti`

ใช้ optional chaining เพื่อกัน runtime error ถ้า user หายไปผิดปกติ

```ts
      this.authService.logout(request.user.jti);
```

ส่ง `jti` ไปลบออกจาก active session store

หลังบรรทัดนี้ token เดิมจะใช้กับ protected route ไม่ได้แล้ว

```ts
    }
```

จบเงื่อนไขตรวจ `jti`

```ts
    response.clearCookie('auth_token', { path: '/' });
```

ลบ cookie `auth_token`

ต้องระบุ `path: '/'` ให้ตรงกับตอน set cookie เพื่อให้ browser/Postman ลบ cookie ตัวเดียวกัน

```ts
    return { message: 'Logged out' };
```

คืน response ตาม contract:

```json
{
  "message": "Logged out"
}
```

```ts
  }
```

จบ method logout

```ts
  private setAuthCookie(response: Response, accessToken: string): void {
```

ประกาศ helper ภายใน controller สำหรับ set cookie

ใช้ `private` เพราะไม่ควรถูกเรียกจากภายนอก class

ใช้ helper เพื่อลดการเขียนซ้ำใน register/login

```ts
    response.cookie('auth_token', accessToken, {
```

สั่ง Express set cookie ชื่อ `auth_token` โดย value คือ access token

```ts
      httpOnly: true,
```

ทำให้ JavaScript ฝั่ง browser อ่าน cookie ไม่ได้ ช่วยลดความเสี่ยง token ถูกขโมยผ่าน XSS

```ts
      secure: this.configService.get<string>('app.env') === 'production',
```

ตั้ง `secure` เป็น true เฉพาะ production

ใน production browser จะส่ง cookie นี้ผ่าน HTTPS เท่านั้น

ใน development ใช้ HTTP localhost ได้ จึงต้องเป็น false

```ts
      sameSite: 'lax',
```

ลดความเสี่ยง CSRF โดยยังอนุญาต top-level navigation ที่ปลอดภัยพอสำหรับหลาย app

```ts
      path: '/',
```

ทำให้ cookie ใช้ได้ทั้ง site ไม่จำกัดแค่ `/auth`

```ts
      maxAge: 7 * 24 * 60 * 60 * 1000,
```

อายุ cookie 7 วัน หน่วยเป็น milliseconds

แม้ cookie อยู่ได้ 7 วัน แต่ JWT เองยังหมดอายุตาม `JWT_ACCESS_EXPIRES_IN`

```ts
    });
```

จบ options ของ cookie และเรียก method set cookie

```ts
  }
```

จบ helper `setAuthCookie`

```ts
}
```

จบ controller

## `src/auth/auth.service.ts`

ไฟล์นี้เป็น business logic หลักของ auth เช่น สร้าง user, ตรวจ password, sign JWT, validate token, revoke session

```ts
import { randomUUID } from 'crypto';
```

ใช้สร้าง id ที่ unique เช่น `jti` ของ token

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
```

นำเข้า:

- `Injectable` เพื่อให้ class นี้ inject ได้ใน NestJS DI container
- `UnauthorizedException` เพื่อ throw `401 Unauthorized`

```ts
import { JwtService } from '@nestjs/jwt';
```

ใช้ sign และ verify JWT

```ts
import * as bcrypt from 'bcrypt';
```

ใช้ compare password ตอน login

password ที่เก็บไว้เป็น hash จึงห้ามเทียบ string ตรง ๆ

```ts
import { LoginDto } from '@/auth/dto/login.dto';
```

นำ type DTO ของ login มาใช้กับ method `login`

```ts
import { RegisterDto } from '@/auth/dto/register.dto';
```

นำ type DTO ของ register มาใช้กับ method `register`

```ts
import { AuthResponse, JwtPayload } from '@/auth/types';
```

นำ type กลางของ response และ JWT payload มาใช้ให้ contract ชัดเจน

```ts
import { User, UsersService } from '@/users/users.service';
```

ใช้ `UsersService` เพื่อสร้าง/ค้นหา user และใช้ `User` เป็น type ของ user object

```ts
@Injectable()
```

บอก NestJS ว่า class นี้เป็น provider ที่ inject ได้

```ts
export class AuthService {
```

ประกาศ service สำหรับ auth logic

```ts
  private readonly activeSessionIds = new Set<string>();
```

สร้าง in-memory session store สำหรับเก็บ `jti` ที่ยัง active

`private` แปลว่าใช้ภายใน service เท่านั้น

`readonly` แปลว่า reference ของ Set ไม่ถูกเปลี่ยนเป็น Set ใหม่ แต่ข้อมูลข้างในยัง add/delete ได้

```ts
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}
```

inject service ที่ต้องใช้:

- `usersService` สำหรับจัดการ user
- `jwtService` สำหรับ sign/verify token

```ts
  async register(dto: RegisterDto): Promise<AuthResponse> {
```

ประกาศ method register รับ DTO และคืน auth response

```ts
    const user = await this.usersService.create(dto);
```

สร้าง user ใหม่ผ่าน `UsersService`

ตรงนี้รวมการ hash password ไว้ใน users service

```ts
    return this.createAuthResponse(user);
```

หลังสร้าง user สำเร็จ สร้าง JWT และ response body ทันที เพื่อให้ register แล้ว login state พร้อมใช้งาน

```ts
  }
```

จบ method register

```ts
  async login(dto: LoginDto): Promise<AuthResponse> {
```

ประกาศ method login รับ email/password และคืน `{ accessToken, user }`

```ts
    const user = this.usersService.findByEmail(dto.email);
```

ค้นหา user ด้วย email

ใน demo นี้เป็น in-memory lookup จึงไม่ต้อง `await`

```ts
    if (!user) {
```

ถ้าไม่พบ user ให้ถือว่า credential ไม่ถูกต้อง

```ts
      throw new UnauthorizedException('Invalid credentials');
```

โยน 401 โดยใช้ข้อความกลาง ไม่บอกว่า email ไม่มีหรือ password ผิด เพื่อไม่ให้ leak ข้อมูล user enumeration

```ts
    }
```

จบเงื่อนไข user ไม่มี

```ts
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
```

ใช้ bcrypt compare password plaintext จาก request กับ hash ที่เก็บไว้

ต้องใช้ `await` เพราะ bcrypt compare เป็น async operation

```ts
    if (!isPasswordValid) {
```

ถ้า password ไม่ตรง

```ts
      throw new UnauthorizedException('Invalid credentials');
```

คืน 401 ด้วยข้อความเดียวกับกรณี user ไม่มี

```ts
    }
```

จบเงื่อนไข password ผิด

```ts
    return this.createAuthResponse(user);
```

เมื่อ credential ถูกต้อง ให้สร้าง token ใหม่และ response

login ทุกครั้งจะได้ `jti` ใหม่ ทำให้แต่ละ session แยก revoke ได้

```ts
  }
```

จบ method login

```ts
  logout(jti: string): void {
```

ประกาศ method logout รับ `jti` ของ token ปัจจุบัน

```ts
    this.activeSessionIds.delete(jti);
```

ลบ `jti` ออกจาก active session store

ถ้า token เดิมถูกใช้ซ้ำ `validateAccessToken` จะ reject

```ts
  }
```

จบ method logout

```ts
  async validateAccessToken(accessToken: string): Promise<JwtPayload> {
```

ประกาศ method validate token รับ token string และคืน payload ถ้าผ่าน

```ts
    const payload = await this.jwtService.verifyAsync<JwtPayload>(accessToken);
```

ตรวจ signature และ expiry ของ JWT ด้วย secret ที่ config ไว้ใน `AuthModule`

ถ้า token ปลอม, signature ผิด, หรือหมดอายุ จะ throw error

```ts
    if (!payload.jti || !this.activeSessionIds.has(payload.jti)) {
```

ตรวจว่า payload มี `jti` และ `jti` นั้นยัง active อยู่

นี่คือส่วนที่ทำให้ logout/revoke ได้จริง

```ts
      throw new UnauthorizedException('Invalid or revoked token');
```

ถ้าไม่มี `jti` หรือถูก revoke แล้ว ให้คืน 401

```ts
    }
```

จบเงื่อนไข session invalid

```ts
    return payload;
```

คืน JWT payload ให้ guard เอาไป attach เป็น `request.user`

```ts
  }
```

จบ method validate token

```ts
  extractTokenFromRequest(request: {
    headers: { authorization?: string };
    cookies?: Record<string, string>;
  }): string | null {
```

ประกาศ helper สำหรับอ่าน token จาก request

รับ object ที่มี `headers.authorization` และ optional `cookies`

คืน token string หรือ `null` ถ้าไม่พบ

```ts
    const authorization = request.headers.authorization;
```

อ่าน header `Authorization`

```ts
    if (authorization?.startsWith('Bearer ')) {
```

ถ้ามี authorization header และขึ้นต้นด้วย `Bearer `

```ts
      return authorization.slice('Bearer '.length);
```

ตัดคำว่า `Bearer ` ออก เหลือเฉพาะ token

ให้ Bearer มี priority ก่อน cookie เพราะ Next BFF จะส่ง token ด้วย header มาที่ backend

```ts
    }
```

จบเงื่อนไข Bearer token

```ts
    return request.cookies?.auth_token ?? null;
```

ถ้าไม่มี Bearer header ให้ fallback ไปอ่าน cookie `auth_token`

ถ้าไม่มี cookie ให้คืน `null`

```ts
  }
```

จบ method extract token

```ts
  private async createAuthResponse(user: User): Promise<AuthResponse> {
```

ประกาศ helper สำหรับสร้าง token และ response กลางที่ใช้ทั้ง register/login

```ts
    const jti = randomUUID();
```

สร้าง JWT ID ใหม่สำหรับ token ใบนี้

```ts
    const payload: JwtPayload = {
```

เริ่มสร้าง payload ที่จะถูก sign เป็น JWT

```ts
      sub: user.id,
```

ใส่ user id ใน standard claim `sub`

```ts
      email: user.email,
```

ใส่ email เพื่อให้ downstream service ใช้ identity ได้ง่าย

```ts
      role: user.role,
```

ใส่ role เพื่อรองรับ role-based authorization ในอนาคต

```ts
      jti,
```

ใส่ JWT ID สำหรับ revoke session/token ใบนี้

```ts
    };
```

จบ payload object

```ts
    const accessToken = await this.jwtService.signAsync(payload);
```

sign payload เป็น JWT access token ด้วย secret และ expiresIn จาก `AuthModule`

```ts
    this.activeSessionIds.add(jti);
```

บันทึกว่า token ใบนี้ยัง active

```ts
    return {
```

เริ่ม return response contract

```ts
      accessToken,
```

คืน token ให้ frontend หรือ Postman นำไปใช้เป็น Bearer token

```ts
      user: {
```

เริ่ม object user ที่ปลอดภัยสำหรับ frontend

```ts
        id: user.id,
```

คืน user id

```ts
        email: user.email,
```

คืน email

```ts
        name: user.name,
```

คืน name

```ts
      },
```

จบ user object

```ts
    };
```

จบ response object

สังเกตว่าไม่มี `passwordHash` ใน response

```ts
  }
```

จบ helper `createAuthResponse`

```ts
}
```

จบ service

## `src/auth/jwt-auth.guard.ts`

ไฟล์นี้เป็นตัวคุม protected route ทุก route เพราะถูก register เป็น global guard ใน `AppModule`

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
```

นำเข้า:

- `CanActivate` interface ของ Nest guard
- `ExecutionContext` เพื่อเข้าถึง request และ metadata
- `Injectable` เพื่อให้ inject ได้
- `UnauthorizedException` เพื่อ throw 401

```ts
import { Reflector } from '@nestjs/core';
```

ใช้ `Reflector` อ่าน metadata จาก decorator เช่น `@Public()`

```ts
import { AuthService } from '@/auth/auth.service';
```

ใช้ auth service เพื่อ extract และ validate token

```ts
import { AuthenticatedRequest } from '@/auth/types';
```

type ของ request ที่สามารถมี `user`

```ts
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
```

key metadata ที่ `@Public()` set ไว้

```ts
@Injectable()
```

ทำให้ guard เป็น provider ที่ Nest inject dependency ได้

```ts
export class JwtAuthGuard implements CanActivate {
```

ประกาศ guard ที่ต้องมี method `canActivate`

```ts
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}
```

inject:

- `reflector` สำหรับอ่านว่า route เป็น public หรือไม่
- `authService` สำหรับ validate token

```ts
  async canActivate(context: ExecutionContext): Promise<boolean> {
```

method หลักของ guard

คืน `true` ถ้า request ไปต่อได้ หรือ throw exception ถ้าไม่ผ่าน

```ts
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
```

อ่าน metadata `isPublic` จาก handler ก่อน แล้ว fallback ไป class

ถ้า method หรือ controller ถูก decorate ด้วย `@Public()` ค่านี้จะเป็น true

```ts
    if (isPublic) {
```

ถ้า route เป็น public

```ts
      return true;
```

อนุญาตให้ผ่านโดยไม่ตรวจ token

```ts
    }
```

จบเงื่อนไข public route

```ts
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
```

แปลง execution context เป็น HTTP context แล้วดึง Express request

```ts
    const accessToken = this.authService.extractTokenFromRequest(request);
```

อ่าน token จาก Bearer header ก่อน แล้ว fallback ไป cookie

```ts
    if (!accessToken) {
```

ถ้าไม่มี token จากทั้งสองทาง

```ts
      throw new UnauthorizedException('Missing access token');
```

คืน 401

```ts
    }
```

จบเงื่อนไข missing token

```ts
    request.user = await this.authService.validateAccessToken(accessToken);
```

ตรวจ token และ attach payload ที่ผ่าน validation แล้วเข้า `request.user`

controller เช่น logout จึงอ่าน `request.user.jti` ได้

```ts
    return true;
```

อนุญาตให้ request ไปถึง controller

```ts
  }
```

จบ method guard

```ts
}
```

จบ guard

## `src/auth/validate-jwt.middleware.ts`

ไฟล์นี้เป็น middleware version ของ token validation ให้ไว้ตาม requirement หากต้องการ apply กับ route group แทน guard

```ts
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
```

นำเข้า decorator และ interface สำหรับ Nest middleware รวมถึง exception 401

```ts
import { NextFunction, Response } from 'express';
```

นำ type ของ Express middleware มาใช้

```ts
import { AuthService } from '@/auth/auth.service';
```

ใช้ logic เดียวกับ guard ผ่าน auth service

```ts
import { AuthenticatedRequest } from '@/auth/types';
```

ใช้ request type ที่รองรับ `request.user`

```ts
@Injectable()
```

ทำให้ middleware inject `AuthService` ได้

```ts
export class ValidateJwtMiddleware implements NestMiddleware {
```

ประกาศ Nest middleware class

```ts
  constructor(private readonly authService: AuthService) {}
```

inject auth service

```ts
  async use(
    request: AuthenticatedRequest,
    _response: Response,
    next: NextFunction,
  ): Promise<void> {
```

method `use` คือ entry point ของ middleware

รับ request, response, และ `next`

ใช้ `_response` เพราะไม่ได้ใช้ response โดยตรง แต่ใส่ไว้ให้ signature ถูกต้อง

```ts
    const accessToken = this.authService.extractTokenFromRequest(request);
```

อ่าน token จาก header หรือ cookie

```ts
    if (!accessToken) {
```

ถ้าไม่มี token

```ts
      throw new UnauthorizedException('Missing access token');
```

หยุด request ด้วย 401

```ts
    }
```

จบเงื่อนไข missing token

```ts
    request.user = await this.authService.validateAccessToken(accessToken);
```

verify JWT, ตรวจ `jti`, แล้ว attach payload เข้า request

```ts
    next();
```

ส่ง request ต่อไปยัง handler ถ้า validate ผ่าน

```ts
  }
```

จบ middleware method

```ts
}
```

จบ middleware class

ตัวอย่างถ้าจะใช้ middleware แทน global guard:

```ts
consumer
  .apply(ValidateJwtMiddleware)
  .forRoutes(
    { path: 'databaseImg', method: RequestMethod.GET },
    { path: 'auth/logout', method: RequestMethod.POST },
  );
```

## `src/auth/types.ts`

ไฟล์นี้รวม type ที่ใช้ซ้ำใน auth module เพื่อลด duplication

```ts
import { Request } from 'express';
```

นำ Express request type มา extend

```ts
import { UserRole } from '@/users/users.service';
```

ใช้ role type จาก user service เพื่อให้ payload กับ user ใช้ role แบบเดียวกัน

```ts
export interface JwtPayload {
```

ประกาศ shape ของ JWT payload

```ts
  sub: string;
```

user id ใน JWT standard claim

```ts
  email: string;
```

email ของ user

```ts
  role: UserRole;
```

role ของ user เช่น `USER` หรือ `ADMIN`

```ts
  jti: string;
```

JWT ID สำหรับ revoke

```ts
}
```

จบ payload type

```ts
export interface AuthenticatedRequest extends Request {
```

ประกาศ request type ที่ extend จาก Express request

```ts
  user?: JwtPayload;
```

เพิ่ม optional `user` property ซึ่งจะถูกเติมโดย guard/middleware หลัง validate token

```ts
}
```

จบ request type

```ts
export interface AuthUser {
```

ประกาศ shape ของ user ที่ปลอดภัยสำหรับ response

```ts
  id: string;
```

user id

```ts
  email: string;
```

email

```ts
  name: string | null;
```

ชื่อ user อาจเป็น string หรือ null

```ts
}
```

จบ auth user type

```ts
export interface AuthResponse {
```

ประกาศ response contract ของ register/login

```ts
  accessToken: string;
```

JWT token ที่ client ใช้ต่อได้

```ts
  user: AuthUser;
```

ข้อมูล user ที่ไม่รวม password/passwordHash

```ts
}
```

จบ auth response type

## `src/auth/dto/register.dto.ts`

DTO นี้กำหนด shape และ validation ของ request body สำหรับ register

```ts
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
```

นำ validator decorators มาใช้กับ DTO

```ts
export class RegisterDto {
```

ประกาศ class DTO

```ts
  @IsEmail()
```

กำหนดว่า field ถัดไปต้องเป็น email format

```ts
  email: string;
```

email ที่ใช้สมัคร

```ts
  @IsString()
```

กำหนดว่า password ต้องเป็น string

```ts
  @MinLength(8)
```

กำหนด password ต้องยาวอย่างน้อย 8 ตัวอักษร

```ts
  password: string;
```

password plaintext จาก request

จะถูก hash ก่อนเก็บ ไม่ถูกส่งกลับ frontend

```ts
  @IsOptional()
```

field ถัดไปไม่บังคับ

```ts
  @IsString()
```

ถ้าส่ง name มา ต้องเป็น string

```ts
  name?: string;
```

ชื่อ user แบบ optional

```ts
}
```

จบ DTO

## `src/auth/dto/login.dto.ts`

DTO นี้กำหนด shape และ validation ของ request body สำหรับ login

```ts
import { IsEmail, IsString, MinLength } from 'class-validator';
```

นำ validator decorators ที่ต้องใช้

```ts
export class LoginDto {
```

ประกาศ class DTO

```ts
  @IsEmail()
```

email ต้องเป็น email format

```ts
  email: string;
```

email ที่ใช้ login

```ts
  @IsString()
```

password ต้องเป็น string

```ts
  @MinLength(8)
```

password ต้องยาวอย่างน้อย 8 ตัวอักษร

```ts
  password: string;
```

password plaintext ที่จะถูกนำไป compare กับ bcrypt hash

```ts
}
```

จบ DTO

## `src/auth/auth.module.ts`

ไฟล์นี้ประกอบ auth feature ให้ NestJS รู้จัก controller, service, และ JWT config

```ts
import { Module } from '@nestjs/common';
```

นำ decorator `@Module()` มาใช้ประกาศ Nest module

```ts
import { ConfigModule, ConfigService } from '@nestjs/config';
```

ใช้ config service อ่าน environment variable ตอนตั้งค่า JWT

```ts
import { JwtModule } from '@nestjs/jwt';
```

นำ JWT module ของ NestJS เข้ามาใช้

```ts
import { AuthController } from '@/auth/auth.controller';
```

นำ controller ของ auth มา register

```ts
import { AuthService } from '@/auth/auth.service';
```

นำ service ของ auth มา register

```ts
import { UsersModule } from '@/users/users.module';
```

นำ users module เข้ามา เพราะ auth service ต้องใช้ users service

```ts
@Module({
```

เริ่มประกาศ module metadata

```ts
  imports: [
```

รายการ module ที่ auth module ต้องพึ่งพา

```ts
    UsersModule,
```

ทำให้ `AuthService` inject `UsersService` ได้

```ts
    JwtModule.registerAsync({
```

register JWT แบบ async เพื่ออ่าน config จาก `ConfigService`

```ts
      imports: [ConfigModule],
```

นำ config module เข้า context ของ JWT registration

```ts
      inject: [ConfigService],
```

บอก Nest ว่า factory ต้องการ `ConfigService`

```ts
      useFactory: (configService: ConfigService) => ({
```

factory function ที่คืน options ของ JwtModule

```ts
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
```

อ่าน secret สำหรับ sign/verify access token

ใช้ `getOrThrow` เพื่อ fail fast ถ้า config หาย

```ts
        signOptions: {
```

เริ่ม options สำหรับการ sign token

```ts
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
```

กำหนดอายุ JWT จาก env หรือ fallback เป็น 15 นาที

```ts
        },
```

จบ sign options

```ts
      }),
```

จบ factory return

```ts
    }),
```

จบ JwtModule registration

```ts
  ],
```

จบ imports

```ts
  controllers: [AuthController],
```

register controller ที่ expose route `/auth/...`

```ts
  providers: [AuthService],
```

register service เป็น provider

```ts
  exports: [AuthService],
```

export `AuthService` เพื่อให้ global guard ที่อยู่นอก module inject ได้

```ts
})
```

จบ module metadata

```ts
export class AuthModule {}
```

ประกาศและ export module

## `src/users/users.service.ts`

ไฟล์นี้เป็น demo user store แบบ in-memory

```ts
import { ConflictException, Injectable } from '@nestjs/common';
```

นำเข้า:

- `ConflictException` สำหรับ email ซ้ำ
- `Injectable` สำหรับ DI

```ts
import * as bcrypt from 'bcrypt';
```

ใช้ hash password ตอน create user

```ts
import { randomUUID } from 'crypto';
```

ใช้สร้าง user id

```ts
export type UserRole = 'USER' | 'ADMIN';
```

กำหนด role ที่ระบบรู้จัก

```ts
export interface User {
```

ประกาศ shape ของ user ภายในระบบ

```ts
  id: string;
```

user id

```ts
  email: string;
```

email ที่ normalize เป็น lowercase

```ts
  name: string | null;
```

ชื่อ user หรือ null

```ts
  role: UserRole;
```

role ของ user

```ts
  passwordHash: string;
```

password hash ที่ได้จาก bcrypt

ฟิลด์นี้ใช้ภายในระบบเท่านั้นและไม่ถูกคืนกลับ frontend

```ts
}
```

จบ user interface

```ts
export interface CreateUserInput {
```

ประกาศ input สำหรับสร้าง user

```ts
  email: string;
```

email ที่รับจาก register

```ts
  password: string;
```

password plaintext ที่จะถูก hash

```ts
  name?: string;
```

ชื่อ optional

```ts
}
```

จบ input interface

```ts
@Injectable()
```

ทำให้ service นี้ inject ได้

```ts
export class UsersService {
```

ประกาศ user service

```ts
  private readonly users = new Map<string, User>();
```

สร้าง in-memory store โดย key คือ user id และ value คือ user object

เหมาะกับ demo เพราะไม่ต้องตั้ง database

production ควรเปลี่ยนเป็น database repository

```ts
  async create(input: CreateUserInput): Promise<User> {
```

สร้าง user ใหม่

เป็น async เพราะต้อง await bcrypt hash

```ts
    const normalizedEmail = input.email.toLowerCase();
```

normalize email เป็น lowercase เพื่อกัน `Test@example.com` กับ `test@example.com` กลายเป็นคนละ account

```ts
    const existingUser = this.findByEmail(normalizedEmail);
```

เช็ก email ซ้ำใน store

```ts
    if (existingUser) {
```

ถ้ามี user email นี้อยู่แล้ว

```ts
      throw new ConflictException('Email is already in use');
```

คืน HTTP 409 Conflict

```ts
    }
```

จบเงื่อนไข email ซ้ำ

```ts
    const user: User = {
```

เริ่มสร้าง user object

```ts
      id: randomUUID(),
```

สร้าง id แบบ UUID

```ts
      email: normalizedEmail,
```

เก็บ email ที่ normalize แล้ว

```ts
      name: input.name ?? null,
```

ถ้าไม่มี name ให้เก็บเป็น null เพื่อ response type ชัดเจน

```ts
      role: 'USER',
```

default role เป็น USER

```ts
      passwordHash: await bcrypt.hash(input.password, 10),
```

hash password ด้วย bcrypt salt rounds 10

เก็บ hash แทน password plaintext

```ts
    };
```

จบ user object

```ts
    this.users.set(user.id, user);
```

บันทึก user เข้า memory store

```ts
    return user;
```

คืน user object ให้ auth service ไปสร้าง token

```ts
  }
```

จบ method create

```ts
  findByEmail(email: string): User | null {
```

ค้นหา user ด้วย email

เป็น sync เพราะเป็น memory lookup

```ts
    const normalizedEmail = email.toLowerCase();
```

normalize email ก่อนค้นหา

```ts
    return (
      Array.from(this.users.values()).find((user) => user.email === normalizedEmail) ?? null
    );
```

แปลง values ใน Map เป็น array แล้วหา user ที่ email ตรงกัน

ถ้าไม่พบคืน null

```ts
  }
```

จบ method findByEmail

```ts
}
```

จบ service

## `src/users/users.module.ts`

```ts
import { Module } from '@nestjs/common';
```

นำ decorator module ของ NestJS

```ts
import { UsersService } from '@/users/users.service';
```

นำ user service มา register

```ts
@Module({
```

เริ่ม module metadata

```ts
  providers: [UsersService],
```

ทำให้ `UsersService` เป็น provider ใน module นี้

```ts
  exports: [UsersService],
```

export service เพื่อให้ `AuthModule` inject ได้

```ts
})
```

จบ metadata

```ts
export class UsersModule {}
```

ประกาศ module

## `src/database-img/database-img.controller.ts`

```ts
import { Controller, Get } from '@nestjs/common';
```

นำ decorator สำหรับ controller และ GET route

```ts
import { RawResponse } from '@/common/decorators/raw-response.decorator';
```

ใช้ข้าม response wrapper เพื่อคืน array ตรงตาม contract

```ts
import { DatabaseImgService } from '@/database-img/database-img.service';
```

นำ service ที่คืนข้อมูล image list

```ts
@Controller('databaseImg')
```

กำหนด base path เป็น `/databaseImg`

```ts
@RawResponse()
```

ทำให้ response ไม่ถูกห่อด้วย `{ statusCode, message, data }`

```ts
export class DatabaseImgController {
```

ประกาศ controller

```ts
  constructor(private readonly databaseImgService: DatabaseImgService) {}
```

inject service สำหรับดึงข้อมูล

```ts
  @Get()
```

ประกาศ `GET /databaseImg`

ไม่มี `@Public()` จึงเป็น protected route โดย global guard

```ts
  findAll() {
```

handler สำหรับ route นี้

```ts
    return this.databaseImgService.findAll();
```

คืนข้อมูลจาก service

```ts
  }
```

จบ handler

```ts
}
```

จบ controller

## `src/database-img/database-img.service.ts`

```ts
import { Injectable } from '@nestjs/common';
```

นำ decorator เพื่อให้ service inject ได้

```ts
export interface DatabaseImage {
```

ประกาศ shape ของ object ที่ route คืนกลับ

```ts
  imagePath: string;
```

path ของรูปภาพ

```ts
  title: string;
```

หัวข้อ content

```ts
  description: string;
```

คำอธิบาย

```ts
}
```

จบ interface

```ts
@Injectable()
```

ทำให้ service นี้อยู่ใน DI container

```ts
export class DatabaseImgService {
```

ประกาศ service

```ts
  findAll(): DatabaseImage[] {
```

method คืน list ของ `DatabaseImage`

```ts
    return [
```

เริ่มคืน array

```ts
      {
```

เริ่ม object item แรก

```ts
        imagePath: '/thumb-react.svg',
```

path รูปตาม contract

```ts
        title: 'Learning React in 2026',
```

title ตาม contract

```ts
        description: 'Lorem',
```

description ตาม contract

```ts
      },
```

จบ item แรก

```ts
    ];
```

จบ array

```ts
  }
```

จบ method

```ts
}
```

จบ service

## `src/database-img/database-img.module.ts`

```ts
import { Module } from '@nestjs/common';
```

นำ `@Module()`

```ts
import { DatabaseImgController } from '@/database-img/database-img.controller';
```

นำ controller เข้ามา register

```ts
import { DatabaseImgService } from '@/database-img/database-img.service';
```

นำ service เข้ามา register

```ts
@Module({
```

เริ่ม module metadata

```ts
  controllers: [DatabaseImgController],
```

register controller เพื่อให้ route `/databaseImg` ใช้งานได้

```ts
  providers: [DatabaseImgService],
```

register service เพื่อให้ controller inject ได้

```ts
})
```

จบ metadata

```ts
export class DatabaseImgModule {}
```

ประกาศ module

## `src/common/decorators/raw-response.decorator.ts`

```ts
import { SetMetadata } from '@nestjs/common';
```

นำ helper สำหรับ set metadata บน class หรือ handler

```ts
export const RAW_RESPONSE_KEY = 'rawResponse';
```

ประกาศ key ของ metadata

ใช้ constant เพื่อลด typo ระหว่าง decorator กับ interceptor

```ts
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
```

ประกาศ decorator `@RawResponse()`

เมื่อใช้ decorator นี้ Nest จะ set metadata `rawResponse = true`

`ResponseInterceptor` จะอ่าน metadata นี้เพื่อไม่ wrap response

## `src/common/interceptors/response.interceptor.ts`

ไฟล์นี้เป็นของ starter เดิม แต่ถูกเพิ่ม logic ให้ข้าม wrapper ได้เมื่อเจอ `@RawResponse()`

บรรทัดสำคัญที่เพิ่ม:

```ts
import { Reflector } from '@nestjs/core';
```

ใช้ service ของ Nest สำหรับอ่าน metadata จาก decorator

```ts
import { RAW_RESPONSE_KEY } from '@/common/decorators/raw-response.decorator';
```

นำ metadata key ของ raw response มาใช้

```ts
  constructor(private readonly reflector: Reflector) {}
```

inject reflector เข้ามาใน interceptor

```ts
    const isRawResponse = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
```

อ่าน metadata จาก route handler และ controller class

ถ้า controller หรือ method มี `@RawResponse()` จะได้ true

```ts
        if (isRawResponse) {
          return data as ApiResponsePayload<T>;
        }
```

ถ้าเป็น raw response ให้คืน data เดิมทันที

นี่คือสิ่งที่ทำให้ `/auth/register`, `/auth/login`, `/auth/logout`, และ `/databaseImg` คืน response ตรงตาม contract

## `src/main.ts`

ไฟล์นี้เป็น entry point ของ Nest app

บรรทัดสำคัญที่เกี่ยวกับ feature นี้:

```ts
import cookieParser from 'cookie-parser';
```

นำ middleware สำหรับ parse Cookie header

ถ้าไม่มีบรรทัดนี้ `request.cookies.auth_token` จะอ่านไม่ได้

```ts
const apiPrefix = configService.get<string>('app.apiPrefix') ?? '';
```

อ่าน API prefix จาก config

default เป็นค่าว่างเพื่อให้ route เป็น `/auth/login` และ `/databaseImg` ตรงตาม prompt

```ts
const port = configService.get<number>('app.port') ?? 8000;
```

default port เป็น 8000 ตาม environment variables ที่กำหนด

```ts
app.use(cookieParser());
```

ติดตั้ง cookie parser middleware ให้ Express request มี `cookies`

```ts
app.enableCors({
  origin: corsOrigins.length > 0 ? corsOrigins : true,
  credentials: true,
});
```

เปิด CORS และอนุญาต credentials เพื่อให้ browser ส่ง cookie ข้าม origin จาก Next dev server ได้

```ts
if (apiPrefix) {
  app.setGlobalPrefix(apiPrefix);
}
```

ตั้ง global prefix เฉพาะเมื่อมีค่า

ถ้า `API_PREFIX=` ว่าง route จะไม่มี prefix

```ts
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
```

เปิด validation ทั่วทั้ง app:

- `transform: true` แปลง plain body เป็น DTO class
- `whitelist: true` ตัด field ที่ไม่มีใน DTO
- `forbidNonWhitelisted: true` reject request ที่ส่ง field เกิน
- `enableImplicitConversion: true` ช่วยแปลง type บางอย่างอัตโนมัติ

```ts
app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
```

ติดตั้ง response interceptor แบบ global และส่ง `Reflector` เข้าไป เพื่อให้ interceptor อ่าน `@RawResponse()` ได้

## `src/app.module.ts`

ไฟล์นี้ประกอบ module ทั้ง app และตั้ง global guard

บรรทัดสำคัญ:

```ts
import { AuthModule } from '@/auth/auth.module';
```

นำ auth feature เข้ามา

```ts
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
```

ใช้ guard ตัวใหม่ที่รองรับทั้ง Bearer และ cookie

```ts
import { DatabaseImgModule } from '@/database-img/database-img.module';
```

นำ protected image route เข้ามา

```ts
import { UsersModule } from '@/users/users.module';
```

นำ user store เข้ามา

```ts
load: [appConfig],
```

โหลด app config หลัก

demo auth นี้ไม่บังคับ database จึงไม่ต้องโหลด database config ใน app module หลัก

```ts
UsersModule,
AuthModule,
DatabaseImgModule,
```

register feature modules ที่ต้องใช้

```ts
{
  provide: APP_GUARD,
  useClass: JwtAuthGuard,
}
```

ตั้ง `JwtAuthGuard` เป็น global guard

ทุก route protected โดย default ยกเว้น route ที่ใช้ `@Public()`

## `src/config/app.config.ts`

ไฟล์นี้ map environment variables เป็น config object

```ts
env: process.env.NODE_ENV ?? 'development',
```

อ่าน environment ปัจจุบัน

```ts
port: Number(process.env.PORT ?? 8000),
```

ใช้ port จาก env หรือ default 8000

```ts
apiPrefix: process.env.API_PREFIX ?? '',
```

default prefix เป็นค่าว่าง เพื่อให้ endpoint ตรง `/auth/...` และ `/databaseImg`

```ts
corsOrigins: (process.env.CORS_ORIGINS ?? process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean),
```

กำหนด origin ที่อนุญาต CORS

ลำดับ fallback:

1. `CORS_ORIGINS`
2. `FRONTEND_ORIGIN`
3. `http://localhost:3000`

รองรับหลาย origin โดยคั่นด้วย comma

```ts
enableSwagger: process.env.ENABLE_SWAGGER !== 'false',
```

เปิด Swagger เป็น default เว้นแต่ตั้งค่าเป็น string `false`

## `src/config/validation.ts`

ไฟล์นี้ validate env ตอน app start

บรรทัดสำคัญ:

```ts
PORT: Joi.number().port().default(8000),
```

บังคับ `PORT` เป็นเลข port และ default 8000

```ts
API_PREFIX: Joi.string().allow('').default(''),
```

อนุญาต API prefix เป็นค่าว่าง

```ts
DATABASE_URL: Joi.string().optional(),
```

ไม่บังคับ database สำหรับ demo auth in-memory

```ts
JWT_ACCESS_SECRET: Joi.string().min(8).default('change-this-secret'),
```

กำหนด secret สำหรับ access token อย่างน้อย 8 ตัวอักษร

production ต้องเปลี่ยนค่านี้เป็น secret จริง

```ts
JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
```

กำหนดอายุ access token เป็น 15 นาทีถ้าไม่ได้ตั้งค่า

```ts
FRONTEND_ORIGIN: Joi.string().uri().default('http://localhost:3000'),
```

กำหนด origin ของ Next frontend

```ts
CORS_ORIGINS: Joi.string().allow('').default(''),
```

รองรับหลาย origin ผ่าน comma-separated string

## `.env.example`

```ini
NODE_ENV=development
```

ระบุ environment ปัจจุบัน

```ini
PORT=8000
```

backend listen ที่ port 8000

```ini
API_PREFIX=
```

prefix ว่างเพื่อให้ endpoint เป็น `/auth/...` และ `/databaseImg`

```ini
JWT_ACCESS_SECRET=change-this-secret
```

secret สำหรับ sign/verify JWT

ควรเปลี่ยนใน production

```ini
JWT_ACCESS_EXPIRES_IN=15m
```

อายุ JWT access token

```ini
FRONTEND_ORIGIN=http://localhost:3000
```

origin ของ Next.js frontend ตอน dev

```ini
CORS_ORIGINS=http://localhost:3000
```

origin ที่ backend อนุญาต CORS

```ini
ENABLE_SWAGGER=true
```

เปิด Swagger docs ใน development

## Security Notes

- `passwordHash` อยู่ใน user store ภายในเท่านั้น ไม่ถูกส่งกลับ frontend
- `auth_token` เป็น httpOnly cookie จึงอ่านด้วย JavaScript ไม่ได้
- Bearer token ยังถูกคืนใน body เพื่อให้ Next API/Postman นำไปใช้ต่อได้
- `JWT_ACCESS_SECRET` ต้องเปลี่ยนใน production
- `activeSessionIds` เป็น in-memory demo store ไม่เหมาะกับหลาย instance
- ถ้าต้อง scale หลาย server ควรใช้ Redis หรือ database เก็บ active/revoked `jti`
- ถ้าใช้ cookie auth จาก browser โดยตรง ต้องตั้ง frontend fetch เป็น `credentials: 'include'`
- ถ้า Next API เป็น BFF, backend ยังควรรองรับ Bearer header เพราะ Next API จะ forward token มาทาง server-to-server request

## Quick Test Summary

```bash
pnpm.cmd run dev
```

1. `POST /auth/register` ด้วย email/password/name
2. copy `accessToken`
3. `GET /databaseImg` พร้อม `Authorization: Bearer <token>`
4. ทดลอง `GET /databaseImg` ด้วย Postman cookie jar
5. `POST /auth/logout`
6. เรียก `GET /databaseImg` ด้วย token เดิมอีกครั้ง ต้องได้ `401`


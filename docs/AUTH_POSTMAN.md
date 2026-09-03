# Auth And Cookie Testing

Base URL:

```txt
http://localhost:8000
```

## 1. Register

```http
POST /auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123",
  "name": "Test User"
}
```

Response:

```json
{
  "accessToken": "jwt-token",
  "user": {
    "id": "user-id",
    "email": "test@example.com",
    "name": "Test User"
  }
}
```

The backend also sets an httpOnly cookie named `auth_token`.

## 2. Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

Response shape is the same as register.

## 3. Protected Route With Bearer Token

Copy `accessToken` from register or login, then call:

```http
GET /databaseImg
Authorization: Bearer jwt-token
```

Expected response:

```json
[
  {
    "imagePath": "/thumb-react.svg",
    "title": "Learning React in 2026",
    "description": "Lorem"
  }
]
```

## 4. Protected Route With Cookie

In Postman, keep the cookie jar enabled after register/login, then call:

```http
GET /databaseImg
Cookie: auth_token=jwt-token
```

You can omit the manual `Cookie` header if Postman saved `auth_token` automatically.

## 5. Logout

```http
POST /auth/logout
Authorization: Bearer jwt-token
```

or use the saved `auth_token` cookie.

Expected response:

```json
{
  "message": "Logged out"
}
```

Logout clears the cookie and removes the token `jti` from the in-memory active session store.

## 6. Verify Revocation

Call the protected route again with the same old token:

```http
GET /databaseImg
Authorization: Bearer old-jwt-token
```

Expected result: `401 Unauthorized`.

This demo can revoke immediately because it stores active token `jti` values in memory. A purely stateless JWT setup without a session or revocation store cannot force logout immediately; it must wait until the token expires.

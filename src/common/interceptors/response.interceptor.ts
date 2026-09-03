import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { Observable, map } from 'rxjs';
import { RAW_RESPONSE_KEY } from '@/common/decorators/raw-response.decorator';
import { ApiResponsePayload } from '@/shared/interfaces/api-response.interface';

function isApiResponse(value: unknown): value is ApiResponsePayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    'message' in value
  );
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponsePayload<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponsePayload<T>> {
    const response = context.switchToHttp().getResponse<Response>();
    const isRawResponse = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return next.handle().pipe(
      map((data: T | ApiResponsePayload<T>) => {
        if (isRawResponse) {
          return data as ApiResponsePayload<T>;
        }

        if (isApiResponse(data)) {
          response.status(data.statusCode);
          return data;
        }

        return {
          statusCode: response.statusCode,
          message: 'Success',
          data,
        };
      }),
    );
  }
}

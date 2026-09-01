import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, map } from 'rxjs';
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
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponsePayload<T>> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data: T | ApiResponsePayload<T>) => {
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

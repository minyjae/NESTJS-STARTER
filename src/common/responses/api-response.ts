import { ApiResponsePayload } from '@/shared/interfaces/api-response.interface';
import { PaginationMeta, PaginatedResult } from '@/shared/interfaces/pagination.interface';

export class ApiResponse {
  static success<T>(data: T, message = 'Success'): ApiResponsePayload<T> {
    return { statusCode: 200, message, data };
  }

  static created<T>(data: T, message = 'Created'): ApiResponsePayload<T> {
    return { statusCode: 201, message, data };
  }

  static updated<T>(data: T, message = 'Updated'): ApiResponsePayload<T> {
    return { statusCode: 200, message, data };
  }

  static deleted(message = 'Deleted'): ApiResponsePayload<null> {
    return { statusCode: 200, message, data: null };
  }

  static item<T>(data: T, message = 'Success'): ApiResponsePayload<T> {
    return this.success(data, message);
  }

  static collection<T>(
    data: T[],
    meta?: PaginationMeta,
    message = 'Success',
  ): ApiResponsePayload<T[]> {
    return { statusCode: 200, message, data, ...(meta ? { meta } : {}) };
  }

  static paginated<T>(
    items: T[],
    pagination: PaginationMeta | PaginatedResult<T>,
    message = 'Success',
  ): ApiResponsePayload<T[]> {
    const meta = 'meta' in pagination ? pagination.meta : pagination;
    return this.collection(items, meta, message);
  }

  static badRequest(message: string, errors?: unknown): ApiResponsePayload<never> {
    return { statusCode: 400, message, errors };
  }

  static unauthorized(message = 'Unauthorized'): ApiResponsePayload<never> {
    return { statusCode: 401, message };
  }

  static forbidden(message = 'Forbidden'): ApiResponsePayload<never> {
    return { statusCode: 403, message };
  }

  static notFound(message = 'Not Found'): ApiResponsePayload<never> {
    return { statusCode: 404, message };
  }

  static internalServerError(message = 'Internal Server Error'): ApiResponsePayload<never> {
    return { statusCode: 500, message };
  }
}

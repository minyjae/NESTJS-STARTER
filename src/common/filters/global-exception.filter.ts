import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { ApiResponse } from '@/common/responses/api-response';

type HttpErrorResponse = string | { message?: string | string[]; error?: string; errors?: unknown };

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const isProduction = this.configService.get<string>('app.env') === 'production';

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse() as HttpErrorResponse;
      const { message, errors } = this.normalizeHttpError(exceptionResponse);

      response.status(statusCode).json({
        statusCode,
        message,
        ...(errors ? { errors } : {}),
      });
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.message : 'Unexpected error',
      exception instanceof Error ? exception.stack : undefined,
    );

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(ApiResponse.internalServerError(isProduction ? 'Internal Server Error' : this.getErrorMessage(exception)));
  }

  private normalizeHttpError(response: HttpErrorResponse): { message: string; errors?: unknown } {
    if (typeof response === 'string') {
      return { message: response };
    }

    if (Array.isArray(response.message)) {
      return {
        message: 'Validation failed',
        errors: response.message,
      };
    }

    return {
      message: response.message ?? response.error ?? 'Request failed',
      errors: response.errors,
    };
  }

  private getErrorMessage(exception: unknown): string {
    return exception instanceof Error ? exception.message : 'Internal Server Error';
  }
}

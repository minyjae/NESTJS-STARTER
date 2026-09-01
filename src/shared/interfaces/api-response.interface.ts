import { PaginationMeta } from './pagination.interface';

export interface ApiResponsePayload<T = unknown> {
  statusCode: number;
  message: string;
  data?: T;
  meta?: PaginationMeta;
  errors?: unknown;
}

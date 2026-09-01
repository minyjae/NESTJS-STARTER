export interface PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  lastPage: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}
